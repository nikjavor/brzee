#include <assert.h>
#include <setjmp.h>
#include <stdio.h>

// Include the actual implementations so the simulator can exercise discovery
// and scheduling internals without exposing extra production API for tests.
#define TAG TWAI_TAG
#include "../components/obd_twai/obd_twai.c"
#undef TAG
#define TAG CAR_DATA_TAG
#include "../components/car_data/car_data.c"
#undef TAG
#define TAG SCHED_TAG
#include "../components/obd_scheduler/obd_scheduler.c"
#undef TAG

typedef struct {
    obd_signal_t signal;
    uint8_t pid, bytes, a, b;
    obd_value_type_t type;
    int32_t expected;
} sample_t;

static const sample_t samples[] = {
    {OBD_SIGNAL_ENGINE_LOAD, 0x04, 1, 128, 0, OBD_VALUE_U16, 50},
    {OBD_SIGNAL_COOLANT_TEMP, 0x05, 1, 0, 0, OBD_VALUE_I16, -40},
    {OBD_SIGNAL_RPM, 0x0C, 2, 0x0F, 0xA0, OBD_VALUE_U16, 1000},
    {OBD_SIGNAL_SPEED, 0x0D, 1, 88, 0, OBD_VALUE_U16, 88},
    {OBD_SIGNAL_THROTTLE_POSITION, 0x11, 1, 0xE3, 0, OBD_VALUE_U16, 89},
    {OBD_SIGNAL_FUEL_LEVEL, 0x2F, 1, 255, 0, OBD_VALUE_U16, 100},
    {OBD_SIGNAL_BAROMETRIC_PRESSURE, 0x33, 1, 100, 0, OBD_VALUE_U16, 100},
    {OBD_SIGNAL_BATTERY_VOLTAGE, 0x42, 2, 0x38, 0xA4, OBD_VALUE_U16, 14500},
    {OBD_SIGNAL_RELATIVE_THROTTLE_POSITION, 0x45, 1, 255, 0, OBD_VALUE_U16, 100},
    {OBD_SIGNAL_AMBIENT_TEMPERATURE, 0x46, 1, 30, 0, OBD_VALUE_I16, -10},
    {OBD_SIGNAL_THROTTLE_ACTUATOR, 0x4C, 1, 0, 0, OBD_VALUE_U16, 0},
    {OBD_SIGNAL_OIL_TEMP, 0x5C, 1, 255, 0, OBD_VALUE_I16, 215},
    {OBD_SIGNAL_MANIFOLD_PRESSURE, 0x0B, 1, 180, 0, OBD_VALUE_U16, 180},
    {OBD_SIGNAL_INTAKE_AIR_TEMP, 0x0F, 1, 20, 0, OBD_VALUE_I16, -20},
    {OBD_SIGNAL_MASS_AIR_FLOW, 0x10, 2, 255, 255, OBD_VALUE_U32, 655350},
    {OBD_SIGNAL_FUEL_RATE, 0x5E, 2, 255, 255, OBD_VALUE_U32, 3276750},
    {OBD_SIGNAL_PEDAL_POSITION_D, 0x49, 1, 255, 0, OBD_VALUE_U16, 100},
    {OBD_SIGNAL_PEDAL_POSITION_E, 0x4A, 1, 128, 0, OBD_VALUE_U16, 50},
    {OBD_SIGNAL_PEDAL_POSITION_F, 0x4B, 1, 0, 0, OBD_VALUE_U16, 0},
    {OBD_SIGNAL_RELATIVE_PEDAL_POSITION, 0x5A, 1, 64, 0, OBD_VALUE_U16, 25},
    {OBD_SIGNAL_THROTTLE_POSITION_B, 0x47, 1, 0xE3, 0, OBD_VALUE_U16, 89},
    {OBD_SIGNAL_THROTTLE_POSITION_C, 0x48, 1, 255, 0, OBD_VALUE_U16, 100},
    {OBD_SIGNAL_SHORT_FUEL_TRIM_BANK_1, 0x06, 1, 118, 0, OBD_VALUE_I16, -781},
    {OBD_SIGNAL_LONG_FUEL_TRIM_BANK_1, 0x07, 1, 138, 0, OBD_VALUE_I16, 781},
    {OBD_SIGNAL_SHORT_FUEL_TRIM_BANK_2, 0x08, 1, 0, 0, OBD_VALUE_I16, -10000},
    {OBD_SIGNAL_LONG_FUEL_TRIM_BANK_2, 0x09, 1, 255, 0, OBD_VALUE_I16, 9921},
    {OBD_SIGNAL_ENGINE_RUN_TIME, 0x1F, 2, 0x12, 0x34, OBD_VALUE_U16, 4660},
    {OBD_SIGNAL_TIMING_ADVANCE, 0x0E, 1, 127, 0, OBD_VALUE_I16, -5},
    {OBD_SIGNAL_DEMANDED_TORQUE, 0x61, 1, 100, 0, OBD_VALUE_I16, -25},
    {OBD_SIGNAL_ACTUAL_TORQUE, 0x62, 1, 175, 0, OBD_VALUE_I16, 50},
    {OBD_SIGNAL_REFERENCE_TORQUE, 0x63, 2, 0x01, 0x2C, OBD_VALUE_U16, 300},
    {OBD_SIGNAL_FUEL_RAIL_PRESSURE, 0x23, 2, 255, 255, OBD_VALUE_U32, 655350},
};

static TickType_t ticks, stop_ticks;
static bool stop_scheduler, drop_page[8][4];
static uint32_t ecu_masks[8][4];
static unsigned sent, head, tail, mutex_depth, mutex_takes;
static twai_rx_item_t queue_items[32];
static twai_frame_t incoming;
static jmp_buf scheduler_exit;
static unsigned request_count[OBD_SIGNAL_COUNT];
static uint32_t request_times[OBD_SIGNAL_COUNT][2048];
static unsigned drop_mode;

TickType_t xTaskGetTickCount(void) { return ticks; }
void vTaskDelay(TickType_t delay) {
    ticks += delay;
    if (stop_scheduler && ticks >= stop_ticks) longjmp(scheduler_exit, 1);
}
BaseType_t xTaskCreate(void (*fn)(void *), const char *name, unsigned stack, void *arg, int priority, void *handle) { return pdPASS; }
QueueHandle_t xQueueCreate(unsigned count, size_t size) { return queue_items; }
BaseType_t xQueueReceive(QueueHandle_t queue, void *out, TickType_t wait) {
    if (head < tail) { memcpy(out, &queue_items[head++], sizeof(twai_rx_item_t)); return pdTRUE; }
    head = tail = 0;
    ticks += wait;
    return pdFALSE;
}
BaseType_t xQueueSendFromISR(QueueHandle_t queue, const void *item, BaseType_t *woken) {
    assert(tail < 32);
    memcpy(&queue_items[tail++], item, sizeof(twai_rx_item_t));
    return pdTRUE;
}
SemaphoreHandle_t xSemaphoreCreateMutex(void) { return &mutex_depth; }
BaseType_t xSemaphoreTake(SemaphoreHandle_t lock, TickType_t wait) { mutex_takes++; assert(mutex_depth++ == 0); return pdTRUE; }
BaseType_t xSemaphoreGive(SemaphoreHandle_t lock) { assert(mutex_depth-- == 1); return pdTRUE; }
const char *esp_err_to_name(esp_err_t err) { return "test error"; }
esp_err_t twai_new_node_onchip(const twai_onchip_node_config_t *config, twai_node_handle_t *out) { *out = (void *)1; return ESP_OK; }
esp_err_t twai_node_register_event_callbacks(twai_node_handle_t node, const twai_event_callbacks_t *cbs, void *ctx) { return ESP_OK; }
esp_err_t twai_node_enable(twai_node_handle_t node) { return ESP_OK; }
esp_err_t twai_node_disable(twai_node_handle_t node) { return ESP_OK; }
esp_err_t twai_node_delete(twai_node_handle_t node) { return ESP_OK; }
esp_err_t twai_node_recover(twai_node_handle_t node) { return ESP_OK; }
esp_err_t twai_node_transmit_wait_all_done(twai_node_handle_t node, int wait) { return ESP_OK; }
esp_err_t twai_node_receive_from_isr(twai_node_handle_t node, twai_frame_t *out) {
    out->header = incoming.header;
    if (!incoming.header.rtr) {
        size_t count = incoming.header.dlc < 8 ? incoming.header.dlc : 8;
        memcpy(out->buffer, incoming.buffer, count);
    }
    return ESP_OK;
}
static void inject(unsigned ecu, uint8_t *data, uint8_t dlc) {
    incoming = (twai_frame_t){.header = {.id = 0x7E8 + ecu, .dlc = dlc}, .buffer = data};
    twai_rx_cb(s_node_hdl, NULL, NULL);
}
static void advertise(unsigned ecu, uint8_t pid) {
    unsigned page = (pid - 1u) / 32u;
    ecu_masks[ecu][page] |= UINT32_C(1) << (31u - (pid - 1u) % 32u);
}
esp_err_t twai_node_transmit(twai_node_handle_t node, const twai_frame_t *frame, int wait) {
    sent++;
    uint8_t pid = frame->buffer[2];
    if (pid % 32 == 0 && pid <= 0x60) {
        unsigned page = pid / 32;
        for (unsigned ecu = 0; ecu < 8; ecu++) {
            if (!ecu_masks[ecu][0] || drop_page[ecu][page]) continue;
            if (page > 0 && !(ecu_masks[ecu][page - 1] & 1u)) continue;
            uint32_t bits = ecu_masks[ecu][page];
            uint8_t data[8] = {6, 0x41, pid, bits >> 24, bits >> 16, bits >> 8, bits};
            inject(ecu, data, 8);
        }
    } else {
        for (unsigned i = 0; i < sizeof(samples) / sizeof(samples[0]); i++) {
            const sample_t *s = &samples[i];
            if (s->pid != pid) continue;
            unsigned count = request_count[s->signal]++;
            assert(count < 2048);
            request_times[s->signal][count] = pdTICKS_TO_MS(ticks);
            if ((drop_mode == 1 && s->signal == OBD_SIGNAL_RPM && count > 0) ||
                (drop_mode == 2 && s->signal != OBD_SIGNAL_RPM) || drop_mode == 3)
                break;
            uint8_t data[8] = {(uint8_t)(s->bytes + 2), 0x41, pid, s->a, s->b};
            inject(0, data, 8);
            break;
        }
    }
    return ESP_OK;
}

static int32_t decoded_integer(const obd_decoded_value_t *value) {
    if (value->type == OBD_VALUE_I16) return value->value.i16;
    if (value->type == OBD_VALUE_U32) return (int32_t)value->value.u32;
    return value->value.u16;
}
static void test_decoders(void) {
    assert(sizeof(samples) / sizeof(samples[0]) == OBD_SIGNAL_COUNT);
    for (unsigned i = 0; i < OBD_SIGNAL_COUNT; i++) {
        const sample_t *s = &samples[i];
        const obd_signal_info_t *info = obd_signal_get_info(s->signal);
        assert(info && info->pid == s->pid && info->value_type == s->type);
        uint8_t data[8] = {(uint8_t)(s->bytes + 2), 0x41, s->pid, s->a, s->b};
        obd_decoded_value_t value;
        assert(obd_signal_decode(s->signal, data, 8, &value));
        assert(value.signal == s->signal && value.type == s->type);
        assert(decoded_integer(&value) == s->expected);
        assert(!obd_signal_decode(s->signal, data, s->bytes + 2, &value));
        data[0] = 0x10;
        assert(!obd_signal_decode(s->signal, data, 8, &value));
        data[0] = s->bytes + 2;
        data[1] = 0x40;
        assert(!obd_signal_decode(s->signal, data, 8, &value));
    }
    assert(obd_signal_get_info((obd_signal_t)-1) == NULL);
    assert(!obd_signal_decode(OBD_SIGNAL_RPM, NULL, 8, NULL));
}
static void test_car_data(void) {
    car_value_t snapshot[CAR_DATA_COUNT];
    uint32_t captured_ms;
    assert(!car_data_get_values_snapshot(snapshot, &captured_ms));
    car_data_init();
    assert(!car_data_get_values_snapshot(NULL, &captured_ms));
    assert(!car_data_get_values_snapshot(snapshot, NULL));
    ticks = 100;
    for (unsigned i = 0; i < CAR_DATA_BOOST_PRESSURE_KPA; i++)
        assert(car_data_update((car_data_id_t)i, (int32_t)i + 100, 1000));
    for (unsigned i = 0; i < CAR_DATA_BOOST_PRESSURE_KPA; i++) {
        int32_t value;
        assert(car_data_get((car_data_id_t)i, &value) && value == (int32_t)i + 100);
    }
    unsigned takes_before = mutex_takes;
    assert(car_data_get_values_snapshot(snapshot, &captured_ms));
    assert(captured_ms == 1000 && mutex_takes == takes_before + 1);
    for (unsigned i = 0; i < CAR_DATA_BOOST_PRESSURE_KPA; i++) {
        assert(snapshot[i].valid && snapshot[i].value == (int32_t)i + 100);
        assert(snapshot[i].timestamp_ms == captured_ms);
    }
    car_data_update(CAR_DATA_MANIFOLD_PRESSURE_KPA, 180, 1000);
    car_data_update(CAR_DATA_BAROMETRIC_PRESSURE_KPA, 100, 1000);
    car_data_update(CAR_DATA_SPEED_KPH, 50, 1000);
    car_data_update(CAR_DATA_FUEL_RATE_ML_H, 8500, 1000);
    car_data_update(CAR_DATA_ACTUAL_TORQUE_PCT, -10, 1000);
    car_data_update(CAR_DATA_REFERENCE_TORQUE_NM, 350, 1000);
    int32_t value;
    assert(car_data_get(CAR_DATA_BOOST_PRESSURE_KPA, &value) && value == 80);
    assert(car_data_get(CAR_DATA_FUEL_CONSUMPTION_ML_100KM, &value) && value == 17000);
    assert(car_data_get(CAR_DATA_ACTUAL_TORQUE_NM, &value) && value == -35);
    assert(car_data_get_values_snapshot(snapshot, &captured_ms));
    assert(snapshot[CAR_DATA_BOOST_PRESSURE_KPA].value == 80);
    assert(snapshot[CAR_DATA_FUEL_CONSUMPTION_ML_100KM].value == 17000);
    assert(snapshot[CAR_DATA_ACTUAL_TORQUE_NM].value == -35);
    car_data_update(CAR_DATA_SPEED_KPH, 0, 1000);
    assert(!car_data_get(CAR_DATA_FUEL_CONSUMPTION_ML_100KM, &value));
    assert(car_data_get(CAR_DATA_FUEL_RATE_ML_H, &value) && value == 8500);
    car_data_invalidate(CAR_DATA_MANIFOLD_PRESSURE_KPA);
    assert(!car_data_get(CAR_DATA_BOOST_PRESSURE_KPA, &value));
    ticks += 1000;
    assert(!car_data_get(CAR_DATA_ACTUAL_TORQUE_NM, &value));
    assert(car_data_get_values_snapshot(snapshot, &captured_ms));
    assert(!snapshot[CAR_DATA_MANIFOLD_PRESSURE_KPA].valid);
    assert(!snapshot[CAR_DATA_BOOST_PRESSURE_KPA].valid);
    assert(!snapshot[CAR_DATA_ACTUAL_TORQUE_NM].valid);
    car_value_t wrapped = {.valid = true, .timestamp_ms = UINT32_MAX - 100};
    assert(is_fresh(&wrapped, 50, 200));
}
static void test_discovery(void) {
    s_node_hdl = (void *)1;
    s_data_queue = xQueueCreate(16, sizeof(twai_rx_item_t));
    advertise(0, 0x0C); advertise(0, 0x05); advertise(0, 0x20);
    advertise(0, 0x2F); advertise(0, 0x40); advertise(0, 0x49);
    advertise(0, 0x60); advertise(0, 0x63);
    advertise(1, 0x0D);
    drop_page[0][2] = true;
    assert(!obd_twai_discover_supported_signals(10));
    assert(obd_twai_signal_support(OBD_SIGNAL_RPM) == OBD_SUPPORT_SUPPORTED);
    assert(obd_twai_signal_support(OBD_SIGNAL_SPEED) == OBD_SUPPORT_SUPPORTED);
    assert(obd_twai_signal_support(OBD_SIGNAL_REFERENCE_TORQUE) == OBD_SUPPORT_SUPPORTED);
    assert(obd_twai_signal_support(OBD_SIGNAL_PEDAL_POSITION_D) == OBD_SUPPORT_UNKNOWN);
    assert(obd_twai_signal_support(OBD_SIGNAL_MASS_AIR_FLOW) == OBD_SUPPORT_UNSUPPORTED);
    unsigned before = sent;
    obd_decoded_value_t value;
    assert(!obd_twai_query_signal(OBD_SIGNAL_MASS_AIR_FLOW, &value, 5) && sent == before);
    drop_page[0][2] = false;
    assert(obd_twai_discover_supported_signals(10));
    assert(obd_twai_signal_support(OBD_SIGNAL_PEDAL_POSITION_D) == OBD_SUPPORT_SUPPORTED);
    assert(obd_twai_query_signal(OBD_SIGNAL_COOLANT_TEMP, &value, 5));
    assert(value.type == OBD_VALUE_I16 && value.value.i16 == -40);
}
static void test_scheduler(void) {
    memset(s_supported_pids, 0, sizeof(s_supported_pids));
    memset(s_support_page_known, 0, sizeof(s_support_page_known));
    memset(ecu_masks, 0, sizeof(ecu_masks));
    for (unsigned i = 0; i < OBD_SIGNAL_COUNT; i++) advertise(0, samples[i].pid);
    advertise(0, 0x20); advertise(0, 0x40); advertise(0, 0x60);
    car_data_init();
    stop_ticks = ticks + 4000;
    stop_scheduler = true;
    if (setjmp(scheduler_exit) == 0) scheduler_task(NULL);
    stop_scheduler = false;
    assert(sizeof(pid_jobs) / sizeof(pid_jobs[0]) == OBD_SIGNAL_COUNT);
    for (unsigned i = 0; i < OBD_SIGNAL_COUNT; i++) {
        int32_t value;
        assert(car_data_get(signal_data_ids[samples[i].signal], &value));
        assert(value == samples[i].expected);
        assert(pid_jobs[i].enabled && pid_jobs[i].last_success_ms != 0);
    }
    // Explicitly unsupported signals must be removed from polling.
    for (unsigned ecu = 0; ecu < 8; ecu++) {
        memset(s_supported_pids[ecu], 0, sizeof(s_supported_pids[ecu]));
        memset(s_support_page_known[ecu], true, sizeof(s_support_page_known[ecu]));
    }
    apply_signal_support();
    for (unsigned i = 0; i < OBD_SIGNAL_COUNT; i++) assert(!pid_jobs[i].enabled);
}
static void setup_timing_fixture(void) {
    ticks = 100; // 1000 ms; keep assertions independent of discovery duration.
    head = tail = 0;
    memset(request_count, 0, sizeof(request_count));
    memset(s_supported_pids, 0, sizeof(s_supported_pids));
    memset(s_support_page_known, 0, sizeof(s_support_page_known));
    for (unsigned page = 0; page < 4; page++) {
        s_supported_pids[0][page] = UINT32_MAX;
        s_support_page_known[0][page] = true;
    }
    for (unsigned i = 0; i < OBD_SIGNAL_COUNT; i++) {
        pid_jobs[i].enabled = false;
        pid_jobs[i].next_due_ms = 0;
        pid_jobs[i].last_success_ms = 0;
        pid_jobs[i].fail_count = 0;
    }
    drop_mode = 0;
    car_data_init();
}
static void run_timing_fixture(unsigned duration_ms) {
    stop_ticks = ticks + pdMS_TO_TICKS(duration_ms);
    stop_scheduler = true;
    if (setjmp(scheduler_exit) == 0) scheduler_task(NULL);
    stop_scheduler = false;
}
static void test_transient_query_failure_keeps_original_sample_timestamp(void) {
    setup_timing_fixture();
    pid_jobs[0].enabled = true; // RPM, the first job.
    drop_mode = 1;
    run_timing_fixture(160);
    assert(request_count[OBD_SIGNAL_RPM] == 2);
    car_value_t value;
    assert(car_data_get_full(CAR_DATA_RPM, &value));
    assert(value.value == 1000 && value.timestamp_ms == 1000);
    assert(pdTICKS_TO_MS(ticks) - value.timestamp_ms == 160);
    // No first successful sample means there is nothing to retain.
    setup_timing_fixture();
    pid_jobs[0].enabled = true;
    drop_mode = 3;
    run_timing_fixture(60);
    assert(!car_data_get_full(CAR_DATA_RPM, &value));
}
static void test_each_pedal_channel_updates_without_one_second_steps(void) {
    const obd_signal_t signals[] = {OBD_SIGNAL_PEDAL_POSITION_E, OBD_SIGNAL_PEDAL_POSITION_F};
    for (unsigned index = 0; index < 2; index++) {
        obd_signal_t signal = signals[index];
        setup_timing_fixture();
        for (unsigned i = 0; i < OBD_SIGNAL_COUNT; i++)
            pid_jobs[i].enabled = pid_jobs[i].signal == signal;
        run_timing_fixture(3000);
        assert(request_count[signal] >= 8);
        for (unsigned i = 1; i < request_count[signal]; i++)
            assert(request_times[signal][i] - request_times[signal][i - 1] <= 350);
    }
}
static void test_missing_auxiliary_pids_cannot_starve_rpm(void) {
    setup_timing_fixture();
    for (unsigned i = 0; i < OBD_SIGNAL_COUNT; i++) pid_jobs[i].enabled = true;
    drop_mode = 2; // RPM responds immediately; every other PID consumes its timeout.
    run_timing_fixture(5000);
    unsigned count = request_count[OBD_SIGNAL_RPM];
    assert(count > 2);
    uint32_t maximum_gap = 0;
    for (unsigned i = 1; i < count; i++) {
        uint32_t gap = request_times[OBD_SIGNAL_RPM][i] - request_times[OBD_SIGNAL_RPM][i - 1];
        if (gap > maximum_gap) maximum_gap = gap;
    }
    fprintf(stderr, "RPM maximum gap with nonresponding auxiliary PIDs: %u ms\n", maximum_gap);
    assert(maximum_gap <= 400); // Leave margin before the phone's 500 ms expiry.
}
static void test_nonresponding_pedal_probes_back_off(void) {
    setup_timing_fixture();
    for (unsigned i = 0; i < OBD_SIGNAL_COUNT; i++)
        pid_jobs[i].enabled = pid_jobs[i].signal == OBD_SIGNAL_RPM || pid_jobs[i].signal == OBD_SIGNAL_PEDAL_POSITION_F;
    drop_mode = 2;
    run_timing_fixture(10000);
    fprintf(stderr, "Unanswered pedal-F probes in 10 seconds: %u\n", request_count[OBD_SIGNAL_PEDAL_POSITION_F]);
    assert(request_count[OBD_SIGNAL_PEDAL_POSITION_F] <= 5);
    car_value_t value;
    assert(!car_data_get_full(CAR_DATA_PEDAL_POSITION_F_PCT, &value));
    assert(request_count[OBD_SIGNAL_RPM] >= 50);
}
static void test_probe_backoff_never_shortens_a_long_poll_interval(void) {
    setup_timing_fixture();
    for (unsigned i = 0; i < OBD_SIGNAL_COUNT; i++)
        pid_jobs[i].enabled = pid_jobs[i].signal == OBD_SIGNAL_RPM || pid_jobs[i].signal == OBD_SIGNAL_REFERENCE_TORQUE;
    drop_mode = 2;
    run_timing_fixture(65000);
    unsigned count = request_count[OBD_SIGNAL_REFERENCE_TORQUE];
    assert(count >= 2);
    for (unsigned i = 1; i < count; i++)
        assert(request_times[OBD_SIGNAL_REFERENCE_TORQUE][i] - request_times[OBD_SIGNAL_REFERENCE_TORQUE][i - 1] >= 30000);
}
int main(void) {
    test_decoders();
    test_car_data();
    test_discovery();
    test_scheduler();
    test_transient_query_failure_keeps_original_sample_timestamp();
    test_each_pedal_channel_updates_without_one_second_steps();
    test_missing_auxiliary_pids_cannot_starve_rpm();
    test_nonresponding_pedal_probes_back_off();
    test_probe_backoff_never_shortens_a_long_poll_interval();
    puts("PASS: 32 decoders, signed/scaled storage, derived values, multi-ECU discovery, timeout retry and 40s scheduler simulation.");
}
