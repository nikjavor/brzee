#include <assert.h>
#include <limits.h>
#include <stdio.h>

// Exercise the actual BLE callbacks without adding production test hooks.
#include "../components/ble/ble.c"

struct ble_hs_cfg_test ble_hs_cfg;
static struct ble_npl_eventq event_queue;
static struct os_mbuf mbuf;
static TickType_t ticks = 100;
static unsigned lock_depth, lock_takes, allocations, sends, packet_count, advertisements;
static unsigned nvs_calls, erases, deinitializations;
static int fail_allocation = -1, fail_send = -1, gatt_result;
static esp_err_t first_nvs_result;
static uint16_t negotiated_mtu = 247;
static bool advertising, host_started;
static uint8_t packets[64][BLE_PROTOCOL_MAX_PACKET_SIZE];
static size_t lengths[64];

TickType_t xTaskGetTickCount(void) { return ticks; }
SemaphoreHandle_t xSemaphoreCreateMutex(void) { return &lock_depth; }
BaseType_t xSemaphoreTake(SemaphoreHandle_t lock, TickType_t wait) {
    assert(lock_depth++ == 0);
    lock_takes++;
    return pdTRUE;
}
BaseType_t xSemaphoreGive(SemaphoreHandle_t lock) { assert(lock_depth-- == 1); return pdTRUE; }
esp_err_t nvs_flash_init(void) { return nvs_calls++ == 0 ? first_nvs_result : ESP_OK; }
esp_err_t nvs_flash_erase(void) { erases++; return ESP_OK; }
esp_err_t nimble_port_init(void) { return ESP_OK; }
esp_err_t nimble_port_deinit(void) { deinitializations++; return ESP_OK; }
void nimble_port_run(void) {}
void nimble_port_freertos_init(void (*task)(void *)) { assert(task == host_task); host_started = true; }
void nimble_port_freertos_deinit(void) {}
struct ble_npl_eventq *nimble_port_get_dflt_eventq(void) { return &event_queue; }
int ble_npl_callout_init(struct ble_npl_callout *timer, struct ble_npl_eventq *queue,
                         void (*callback)(struct ble_npl_event *), void *arg) {
    assert(queue == &event_queue);
    timer->callback = callback;
    return 0;
}
void ble_npl_callout_stop(struct ble_npl_callout *timer) { timer->active = false; }
int ble_npl_callout_reset(struct ble_npl_callout *timer, uint32_t delay) {
    timer->active = true;
    timer->ticks = delay;
    return 0;
}
uint32_t ble_npl_time_ms_to_ticks32(uint32_t ms) { return pdMS_TO_TICKS(ms); }
void ble_svc_gap_init(void) {}
void ble_svc_gatt_init(void) {}
int ble_svc_gap_device_name_set(const char *name) { assert(strcmp(name, "BRZI") == 0); return 0; }
int ble_gatts_count_cfg(const struct ble_gatt_svc_def *services) { return gatt_result; }
int ble_gatts_add_svcs(const struct ble_gatt_svc_def *services) {
    assert(services[0].characteristics[0].flags == BLE_GATT_CHR_F_NOTIFY);
    *services[0].characteristics[0].val_handle = 0x42;
    return 0;
}
int ble_gap_adv_active(void) { return advertising; }
int ble_gap_adv_set_fields(const struct ble_hs_adv_fields *fields) {
    assert(fields->name_len == 4 && memcmp(fields->name, "BRZI", 4) == 0);
    assert(fields->num_uuids128 == 1 && fields->uuids128_is_complete);
    assert(fields->uuids128 == &s_service_uuid);
    return 0;
}
int ble_gap_adv_start(uint8_t address_type, const void *peer, int32_t duration,
                       const struct ble_gap_adv_params *params,
                       int (*callback)(struct ble_gap_event *, void *), void *arg) {
    assert(!advertising && s_connection == BLE_HS_CONN_HANDLE_NONE);
    assert(callback == gap_event && duration == BLE_HS_FOREVER);
    advertisements++;
    advertising = true;
    return 0;
}
int ble_hs_util_ensure_addr(int privacy) { return 0; }
int ble_hs_id_infer_auto(int privacy, uint8_t *type) { *type = 0; return 0; }
uint16_t ble_att_mtu(uint16_t connection) { assert(connection == s_connection); return negotiated_mtu; }
struct os_mbuf *ble_hs_mbuf_from_flat(const void *data, uint16_t length) {
    assert(lock_depth == 0 && !mbuf.owned && length <= negotiated_mtu - 3);
    if ((int)allocations++ == fail_allocation) return NULL;
    memcpy(mbuf.data, data, length);
    mbuf.len = length;
    mbuf.owned = true;
    return &mbuf;
}
int ble_gatts_notify_custom(uint16_t connection, uint16_t handle, struct os_mbuf *buffer) {
    assert(connection == s_connection && handle == s_telemetry_handle);
    assert(buffer == &mbuf && buffer->owned);
    buffer->owned = false; // Also consumed on failure, as in NimBLE.
    if ((int)sends++ == fail_send) return ESP_FAIL;
    assert(packet_count < 64);
    memcpy(packets[packet_count], buffer->data, buffer->len);
    lengths[packet_count++] = buffer->len;
    return 0;
}

static uint32_t read_u32(const uint8_t *data) {
    return (uint32_t)data[0] | (uint32_t)data[1] << 8 |
           (uint32_t)data[2] << 16 | (uint32_t)data[3] << 24;
}
static uint16_t read_u16(const uint8_t *data) { return data[0] | (uint16_t)data[1] << 8; }

static void test_encoding(void) {
    car_value_t values[CAR_DATA_COUNT] = {0};
    values[0] = (car_value_t){true, 950, 0x12345678};
    values[1] = (car_value_t){false, 900, 999};
    values[2] = (car_value_t){true, (uint32_t)(1000u - 100000u), -40};
    values[7] = (car_value_t){true, 1000, 14500};
    values[34] = (car_value_t){true, 1000, INT32_MIN};
    uint8_t body[BLE_PROTOCOL_BODY_SIZE];
    ble_protocol_encode(values, 1000, body);
    // Independent byte fixture: capture time, validity, and four readings.
    const uint8_t expected[219] = {
        [0] = 0xe8, [1] = 0x03, [4] = 0x85, [8] = 0x04,
        [9] = 0x78, [10] = 0x56, [11] = 0x34, [12] = 0x12, [13] = 50,
        [21] = 0xd8, [22] = 0xff, [23] = 0xff, [24] = 0xff, [25] = 0xff, [26] = 0xff,
        [51] = 0xa4, [52] = 0x38, [216] = 0x80,
    };
    assert(sizeof(body) == sizeof(expected) && memcmp(body, expected, sizeof(body)) == 0);
    uint8_t packet[BLE_PROTOCOL_MAX_PACKET_SIZE];
    assert(ble_protocol_fragment(body, 0x1234, 247, 0, packet) == 224);
    const uint8_t header[] = {1, 0x34, 0x12, 0, 1};
    assert(memcmp(packet, header, sizeof(header)) == 0);
    assert(memcmp(packet + 5, expected, sizeof(expected)) == 0);

    values[0] = (car_value_t){true, UINT32_MAX - 49, INT32_MAX};
    ble_protocol_encode(values, 50, body);
    assert(read_u32(body + 9) == INT32_MAX && read_u16(body + 13) == 100);
    values[0].timestamp_ms = (uint32_t)(50u - 65534u);
    ble_protocol_encode(values, 50, body);
    assert(read_u16(body + 13) == 65534);
    values[0].timestamp_ms--;
    ble_protocol_encode(values, 50, body);
    assert(read_u16(body + 13) == UINT16_MAX);
}

static void test_fragmentation(void) {
    const uint16_t mtus[] = {23, 185, 247, 517};
    const unsigned counts[] = {15, 2, 1, 1};
    const unsigned total_bytes[] = {294, 229, 224, 224};
    uint8_t body[219], assembled[219];
    for (unsigned i = 0; i < sizeof(body); i++) body[i] = (uint8_t)i;
    for (unsigned m = 0; m < 4; m++) {
        size_t offset = 0, sent_bytes = 0;
        for (unsigned i = 0; i < counts[m]; i++) {
            uint8_t guarded[BLE_PROTOCOL_MAX_PACKET_SIZE + 2] = {0};
            guarded[0] = guarded[sizeof(guarded) - 1] = 0xa5;
            uint8_t *packet = guarded + 1;
            size_t length = ble_protocol_fragment(body, UINT16_MAX, mtus[m], i, packet);
            assert(length > 5 && length <= (size_t)mtus[m] - 3);
            assert(read_u16(packet + 1) == UINT16_MAX);
            assert(packet[3] == i && packet[4] == counts[m]);
            assert(guarded[0] == 0xa5 && guarded[sizeof(guarded) - 1] == 0xa5);
            memcpy(assembled + offset, packet + 5, length - 5);
            offset += length - 5;
            sent_bytes += length;
        }
        assert(offset == sizeof(body) && memcmp(assembled, body, sizeof(body)) == 0);
        assert(sent_bytes == total_bytes[m]);
        uint8_t packet[BLE_PROTOCOL_MAX_PACKET_SIZE];
        assert(ble_protocol_fragment(body, 0, mtus[m], counts[m], packet) == 0);
        assert(ble_protocol_fragment(body, 0, 22, 0, packet) == 0);
    }
}

static void clear_packets(void) {
    assert(!mbuf.owned);
    allocations = sends = packet_count = 0;
    fail_allocation = fail_send = -1;
}
static void connect_phone(void) {
    advertising = false;
    struct ble_gap_event event = {.type = BLE_GAP_EVENT_CONNECT,
                                  .connect = {.status = 0, .conn_handle = 7}};
    assert(gap_event(&event, NULL) == 0);
}
static void subscribe(bool enabled) {
    struct ble_gap_event event = {.type = BLE_GAP_EVENT_SUBSCRIBE,
        .subscribe = {.conn_handle = 7, .attr_handle = 0x42, .cur_notify = enabled}};
    assert(gap_event(&event, NULL) == 0);
}
static void tick_publisher(void) {
    assert(s_publish_timer.active && s_publish_timer.ticks == pdMS_TO_TICKS(100));
    ticks += s_publish_timer.ticks;
    s_publish_timer.active = false;
    s_publish_timer.callback(NULL);
}
static void test_lifecycle(void) {
    car_data_init();
    assert(car_data_update(CAR_DATA_RPM, 1000, 1000));
    first_nvs_result = ESP_FAIL;
    assert(ble_start() == ESP_FAIL && !host_started);
    first_nvs_result = ESP_ERR_NVS_NO_FREE_PAGES;
    nvs_calls = 0;
    gatt_result = ESP_FAIL;
    assert(ble_start() == ESP_FAIL && deinitializations == 1 && erases == 1);
    gatt_result = 0;
    assert(ble_start() == ESP_OK && host_started);
    assert(ble_start() == ESP_ERR_INVALID_STATE);
    assert(!advertising && !s_publish_timer.active);
    ble_hs_cfg.sync_cb();
    assert(advertising && advertisements == 1);
    connect_phone();
    publish(NULL);
    assert(packet_count == 0 && !s_publish_timer.active);
    subscribe(true);
    assert(packet_count == 1 && lengths[0] == 224);
    assert(read_u32(packets[0] + 5 + 9) == 1000);
    unsigned takes = lock_takes;
    tick_publisher();
    assert(packet_count == 2 && lock_takes == takes + 1);
    assert(read_u16(packets[1] + 1) == read_u16(packets[0] + 1) + 1);
    subscribe(false);
    publish(NULL); // A timer callback already queued when unsubscribing is harmless.
    assert(packet_count == 2 && !s_publish_timer.active);

    clear_packets();
    negotiated_mtu = 23;
    subscribe(true);
    assert(packet_count == 15);
    clear_packets();
    fail_send = 3;
    tick_publisher();
    assert(packet_count == 3 && sends == 4 && s_publish_timer.active);
    uint16_t interrupted_sequence = read_u16(packets[0] + 1);
    clear_packets();
    tick_publisher();
    assert(packet_count == 15 && read_u16(packets[0] + 1) == interrupted_sequence + 1);

    clear_packets();
    fail_allocation = 1;
    tick_publisher();
    assert(packet_count == 1 && allocations == 2);
    clear_packets();
    negotiated_mtu = 185;
    tick_publisher();
    assert(packet_count == 2);
    clear_packets();
    negotiated_mtu = 247;
    fail_allocation = 0;
    tick_publisher();
    assert(packet_count == 0 && s_publish_timer.active);
    clear_packets();
    car_data_update(CAR_DATA_RPM, 2345, pdTICKS_TO_MS(ticks));
    tick_publisher();
    assert(packet_count == 1 && read_u32(packets[0] + 14) == 2345);

    clear_packets();
    s_sequence = UINT16_MAX;
    tick_publisher();
    tick_publisher();
    assert(read_u16(packets[0] + 1) == UINT16_MAX && read_u16(packets[1] + 1) == 0);
    struct ble_gap_event disconnect = {.type = BLE_GAP_EVENT_DISCONNECT};
    gap_event(&disconnect, NULL);
    assert(advertising && !s_subscribed && !s_publish_timer.active);
    unsigned count = packet_count;
    publish(NULL);
    assert(packet_count == count);
    connect_phone();
    assert(!s_subscribed);
    subscribe(true);
    assert(packet_count == count + 1);
    advertising = false;
    ble_hs_cfg.reset_cb(99);
    assert(s_connection == BLE_HS_CONN_HANDLE_NONE && !s_publish_timer.active);
    publish(NULL);
    assert(packet_count == count + 1);
    ble_hs_cfg.sync_cb();
    assert(advertising);

    advertising = false;
    struct ble_gap_event failed = {.type = BLE_GAP_EVENT_CONNECT, .connect = {.status = 1}};
    gap_event(&failed, NULL);
    assert(advertising);
}

int main(void) {
    test_encoding();
    test_fragmentation();
    test_lifecycle();
    puts("PASS: BLE byte fixtures, signed values, age saturation/wrap, MTUs 23/185/247, subscription, reconnect/reset, congestion recovery and sequence rollover.");
}
