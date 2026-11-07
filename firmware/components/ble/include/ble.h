#pragma once

#include "esp_err.h"

// Starts the BRZEE telemetry peripheral. Call once after car_data_init().
esp_err_t ble_start(void);
