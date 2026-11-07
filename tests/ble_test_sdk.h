#pragma once

#include "test_sdk.h"

#define ESP_LOGE(...) ((void)0)
#define ESP_ERR_NVS_NO_FREE_PAGES -10
#define ESP_ERR_NVS_NEW_VERSION_FOUND -11
#define BLE_HS_CONN_HANDLE_NONE UINT16_MAX
#define BLE_HS_FOREVER INT32_MAX
#define BLE_ATT_ERR_READ_NOT_PERMITTED 2
#define BLE_GATT_SVC_TYPE_PRIMARY 1
#define BLE_GATT_CHR_F_NOTIFY 16
#define BLE_HS_ADV_F_DISC_GEN 2
#define BLE_HS_ADV_F_BREDR_UNSUP 4
#define BLE_GAP_CONN_MODE_UND 2
#define BLE_GAP_DISC_MODE_GEN 2
#define BLE_GAP_EVENT_CONNECT 1
#define BLE_GAP_EVENT_DISCONNECT 2
#define BLE_GAP_EVENT_SUBSCRIBE 3
#define BLE_GAP_EVENT_ADV_COMPLETE 4
#define BLE_NPL_OK 0

typedef struct { uint8_t type; } ble_uuid_t;
typedef struct { ble_uuid_t u; uint8_t value[16]; } ble_uuid128_t;
#define BLE_UUID128_INIT(...) { .u = {128}, .value = {__VA_ARGS__} }

struct ble_gatt_access_ctxt { int unused; };
struct ble_gatt_chr_def {
    const ble_uuid_t *uuid;
    int (*access_cb)(uint16_t, uint16_t, struct ble_gatt_access_ctxt *, void *);
    unsigned flags;
    uint16_t *val_handle;
};
struct ble_gatt_svc_def {
    unsigned type;
    const ble_uuid_t *uuid;
    const struct ble_gatt_chr_def *characteristics;
};
struct ble_hs_adv_fields {
    uint8_t flags;
    const uint8_t *name;
    uint8_t name_len;
    bool name_is_complete;
    const ble_uuid128_t *uuids128;
    uint8_t num_uuids128;
    bool uuids128_is_complete;
};
struct ble_gap_adv_params { unsigned conn_mode, disc_mode; };
struct ble_gap_event {
    unsigned type;
    union {
        struct { int status; uint16_t conn_handle; } connect;
        struct { uint16_t conn_handle, attr_handle; bool cur_notify; } subscribe;
    };
};
struct ble_hs_cfg_test { void (*reset_cb)(int); void (*sync_cb)(void); };
extern struct ble_hs_cfg_test ble_hs_cfg;

struct ble_npl_event { int unused; };
struct ble_npl_eventq { int unused; };
struct ble_npl_callout {
    void (*callback)(struct ble_npl_event *);
    uint32_t ticks;
    bool active;
};
struct os_mbuf { uint8_t data[244]; uint16_t len; bool owned; };

esp_err_t nvs_flash_init(void);
esp_err_t nvs_flash_erase(void);
esp_err_t nimble_port_init(void);
esp_err_t nimble_port_deinit(void);
void nimble_port_run(void);
void nimble_port_freertos_init(void (*task)(void *));
void nimble_port_freertos_deinit(void);
struct ble_npl_eventq *nimble_port_get_dflt_eventq(void);
int ble_npl_callout_init(struct ble_npl_callout *, struct ble_npl_eventq *,
                         void (*callback)(struct ble_npl_event *), void *);
void ble_npl_callout_stop(struct ble_npl_callout *);
int ble_npl_callout_reset(struct ble_npl_callout *, uint32_t);
uint32_t ble_npl_time_ms_to_ticks32(uint32_t ms);
void ble_svc_gap_init(void);
void ble_svc_gatt_init(void);
int ble_svc_gap_device_name_set(const char *);
int ble_gatts_count_cfg(const struct ble_gatt_svc_def *);
int ble_gatts_add_svcs(const struct ble_gatt_svc_def *);
int ble_gap_adv_active(void);
int ble_gap_adv_set_fields(const struct ble_hs_adv_fields *);
int ble_gap_adv_start(uint8_t, const void *, int32_t, const struct ble_gap_adv_params *,
                       int (*callback)(struct ble_gap_event *, void *), void *);
int ble_hs_util_ensure_addr(int);
int ble_hs_id_infer_auto(int, uint8_t *);
uint16_t ble_att_mtu(uint16_t);
struct os_mbuf *ble_hs_mbuf_from_flat(const void *, uint16_t);
int ble_gatts_notify_custom(uint16_t, uint16_t, struct os_mbuf *);
