#!/usr/bin/env python3
"""Run production OBD, car data, and BLE code with a simulated SDK and sanitizers."""
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SDK = r'''
#pragma once
#include <assert.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>
typedef uint32_t TickType_t;
typedef int BaseType_t;
typedef void *QueueHandle_t;
typedef void *SemaphoreHandle_t;
typedef int portMUX_TYPE;
typedef int esp_err_t;
typedef int gpio_num_t;
typedef void *twai_node_handle_t;
#define GPIO_NUM_16 16
#define GPIO_NUM_17 17
#define GPIO_NUM_NC -1
#define ESP_OK 0
#define ESP_FAIL -1
#define ESP_ERR_INVALID_STATE -2
#define ESP_ERR_NO_MEM -3
#define pdFALSE 0
#define pdTRUE 1
#define pdPASS 1
#define portMAX_DELAY UINT32_MAX
#define pdMS_TO_TICKS(ms) ((TickType_t)(ms) / 10u)
#define pdTICKS_TO_MS(ticks) ((uint32_t)(ticks) * 10u)
#define portMUX_INITIALIZER_UNLOCKED 0
#define portENTER_CRITICAL(x) ((void)(x))
#define portEXIT_CRITICAL(x) ((void)(x))
#define portENTER_CRITICAL_ISR(x) ((void)(x))
#define portEXIT_CRITICAL_ISR(x) ((void)(x))
#define configASSERT(x) assert(x)
#define ESP_ERROR_CHECK(x) assert((x) == ESP_OK)
#define ESP_LOGI(...) ((void)0)
#define ESP_LOGW(...) ((void)0)
#define ESP_LOGD(...) ((void)0)
#define ESP_LOG_DEBUG 4
#define ESP_LOG_BUFFER_HEX_LEVEL(...) ((void)0)
#define TWAI_ERROR_BUS_OFF 3

typedef struct { uint32_t id; bool ide; bool rtr; uint8_t dlc; } test_header_t;
typedef struct { test_header_t header; uint8_t *buffer; size_t buffer_len; } twai_frame_t;
typedef struct { int unused; } twai_rx_done_event_data_t;
typedef struct { int old_sta; int new_sta; } twai_state_change_event_data_t;
typedef struct {
    bool (*on_rx_done)(twai_node_handle_t, const twai_rx_done_event_data_t *, void *);
    bool (*on_state_change)(twai_node_handle_t, const twai_state_change_event_data_t *, void *);
} twai_event_callbacks_t;
typedef struct {
    struct { int tx, rx, quanta_clk_out, bus_off_indicator; } io_cfg;
    struct { uint32_t bitrate; } bit_timing;
    unsigned tx_queue_depth;
    struct { bool enable_listen_only; } flags;
} twai_onchip_node_config_t;

TickType_t xTaskGetTickCount(void);
void vTaskDelay(TickType_t ticks);
BaseType_t xTaskCreate(void (*fn)(void *), const char *, unsigned, void *, int, void *);
QueueHandle_t xQueueCreate(unsigned, size_t);
BaseType_t xQueueReceive(QueueHandle_t, void *, TickType_t);
BaseType_t xQueueSendFromISR(QueueHandle_t, const void *, BaseType_t *);
SemaphoreHandle_t xSemaphoreCreateMutex(void);
BaseType_t xSemaphoreTake(SemaphoreHandle_t, TickType_t);
BaseType_t xSemaphoreGive(SemaphoreHandle_t);
const char *esp_err_to_name(esp_err_t);
esp_err_t twai_new_node_onchip(const twai_onchip_node_config_t *, twai_node_handle_t *);
esp_err_t twai_node_register_event_callbacks(twai_node_handle_t, const twai_event_callbacks_t *, void *);
esp_err_t twai_node_enable(twai_node_handle_t);
esp_err_t twai_node_disable(twai_node_handle_t);
esp_err_t twai_node_delete(twai_node_handle_t);
esp_err_t twai_node_recover(twai_node_handle_t);
esp_err_t twai_node_transmit(twai_node_handle_t, const twai_frame_t *, int);
esp_err_t twai_node_transmit_wait_all_done(twai_node_handle_t, int);
esp_err_t twai_node_receive_from_isr(twai_node_handle_t, twai_frame_t *);
'''

with tempfile.TemporaryDirectory(prefix='brzee-tests-') as folder:
    folder = Path(folder)
    (folder / 'test_sdk.h').write_text(SDK)
    for header in ['freertos/FreeRTOS.h', 'freertos/queue.h', 'freertos/task.h',
                   'freertos/semphr.h', 'driver/gpio.h', 'esp_err.h', 'esp_log.h',
                   'esp_twai.h', 'esp_twai_onchip.h']:
        target = folder / header
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text('#include "test_sdk.h"\n')
    command = ['cc', '-std=c11', '-Wall', '-Wextra', '-Wno-unused-parameter',
               '-Wno-unused-variable', '-fsanitize=address,undefined', '-g',
               '-I' + str(folder)]
    for component in ['obd_twai', 'obd_scheduler', 'car_data']:
        command += ['-I' + str(ROOT / 'components' / component / 'include')]
    command += [str(ROOT / 'tests/test_obd.c'),
                str(ROOT / 'components/obd_twai/obd_signals.c'), '-o', str(folder / 'test_obd')]
    subprocess.run(command, check=True)
    subprocess.run([str(folder / 'test_obd')], check=True)

    for header in ['nvs_flash.h', 'host/ble_att.h', 'host/ble_gap.h',
                   'host/ble_gatt.h', 'host/ble_hs.h', 'host/ble_hs_mbuf.h',
                   'host/ble_uuid.h', 'host/util/util.h',
                   'nimble/nimble_npl.h', 'nimble/nimble_port.h',
                   'nimble/nimble_port_freertos.h', 'services/gap/ble_svc_gap.h',
                   'services/gatt/ble_svc_gatt.h']:
        target = folder / header
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text('#include "ble_test_sdk.h"\n')
    command = ['cc', '-std=c11', '-Wall', '-Wextra', '-Werror',
               '-Wno-unused-parameter', '-Wno-unused-variable',
               '-fsanitize=address,undefined', '-g', '-I' + str(folder),
               '-I' + str(ROOT / 'tests'),
               '-I' + str(ROOT / 'components/car_data/include'),
               '-I' + str(ROOT / 'components/ble/include'),
               '-I' + str(ROOT / 'components/ble'),
               str(ROOT / 'tests/test_ble.c'),
               str(ROOT / 'components/ble/ble_protocol.c'),
               str(ROOT / 'components/car_data/car_data.c'),
               '-o', str(folder / 'test_ble')]
    subprocess.run(command, check=True)
    subprocess.run([str(folder / 'test_ble')], check=True)
