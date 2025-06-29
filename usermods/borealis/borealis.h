#pragma once
#include "wled.h"
#include "esp_system.h"
#include "esp_efuse.h"
#include "nvs_flash.h"
#include "borealis-defaults.h"
#include "../audioreactive/audio_reactive.h"

class BorealisUsermod : public Usermod {

  private:

    // The base button handling code was pulled out of wled and heavily modified
    #define WLED_DEBOUNCE_THRESHOLD      20 // only consider button input of at least 50ms as valid (debouncing)
    #define WLED_LONG_PRESS             800 // long press if button is released after held for at least 600ms
    #define WLED_DOUBLE_PRESS           350 // double press if another press within 350ms after a short press
    #define WLED_LONG_REPEATED_ACTION   300 // how often a repeated action (e.g. dimming) is fired on long press on button IDs >0
    #define WLED_LONG_FACTORY_RESET   10000 // how long button 0 needs to be held to trigger a factory reset

    // Storing what preset we show
    int currentPreset = 1;

    // Which group we're in
    int preset_group;

    // Track current preset for each group
    int group_presets[3] = {1, 101, 201};

    // The last preset we saved, and the last time it was saved
    int preset_saved = 1;
    long preset_last_changed;
    
    unsigned long buttonPressedTimeStart;

    #define BRIGHTNESS_COUNT 5
    int brightness_values[BRIGHTNESS_COUNT] = {20, 50, 80, 120, 150};
    // int brightness_values[BRIGHTNESS_COUNT] = {20, 60, 90, 150};
    int brightness_index = 1;
    bool brightnessChanged = false;

    // Hardware mac address & local instance name
    uint8_t mac[6]; 

    long gain_last_changed;
    int loaded_gain_value = 128;


  public:

    BorealisUsermod():Usermod("Borealis", true) {}

    void setup() {
      Serial.println("Borealis --- usermod startup");
      simplifiedUI = true;      // Force users into our UI by default
      Serial.println(apPass);

      // If the last used preset file is missing then we're a fresh install, deploy the configs
      File f = WLED_FS.open("/lastpreset.txt", "r");
      if (!f) {
        Serial.println("Borealis -- No preset file, initializing config");
        factory_reset();
      } else {
        char presetStr[4];
        size_t bytesRead = f.readBytes(presetStr, sizeof(presetStr)-1);
        presetStr[bytesRead] = '\0';  // Null terminate
        currentPreset = atoi(presetStr);
        
        // Initialize group presets based on current preset
        if (currentPreset > 200) {
          preset_group = 2;
          group_presets[2] = currentPreset;
        } else if (currentPreset > 100) {
          preset_group = 1;
          group_presets[1] = currentPreset;
        } else {
          preset_group = 0;
          group_presets[0] = currentPreset;
        }
      }
      f.close();

      Serial.print("Borealis -- Startup: ");
      Serial.println(currentPreset);
      preset_last_changed = millis();

      File gain_f = WLED_FS.open("/gain.txt", "r");
      if (gain_f) {
        char gainStr[4];
        size_t bytesRead = gain_f.readBytes(gainStr, sizeof(gainStr)-1);
        gainStr[bytesRead] = '\0';
        loaded_gain_value = atoi(gainStr);
        inputLevel = loaded_gain_value;
        gain_last_changed = millis();
      }
      gain_f.close();

      // Set initial brightness to second value
      brightness_index = 1;
      bri = brightness_values[brightness_index];
      strip.setBrightness(bri);

      applyPreset(currentPreset);

    }

    void addToConfig(JsonObject& root) {
      Usermod::addToConfig(root); JsonObject top = root["Borealis"]; //WLEDMM
      JsonArray brightnessArray = top.createNestedArray("brightness-values");
      for (int i = 0; i < BRIGHTNESS_COUNT; i++) {
        brightnessArray.add(brightness_values[i]);
      }
      brightnessChanged = true;
    }

    bool readFromConfig(JsonObject& root) {
      bool configComplete = Usermod::readFromConfig(root);JsonObject top = root["Borealis"]; //WLEDMM

      JsonArray brightnessArray = top["brightness-values"];
      if (!brightnessArray.isNull()) {
        for (int i = 0; i < BRIGHTNESS_COUNT && i < brightnessArray.size(); i++) {
          brightness_values[i] = brightnessArray[i] | brightness_values[i];
          brightness_values[i] = constrain(brightness_values[i], 0, 255);
        }
      }

      // Set simplifiedUI based on enabled state
      simplifiedUI = enabled;

      return configComplete;
    }

    void factory_reset() {
        // Get wifi key from efuse
        uint8_t efuse_data[8];
        static const esp_efuse_desc_t WIFI_KEY[] = { {EFUSE_BLK3, 0, 64} };
        const esp_efuse_desc_t* ESP_EFUSE_WIFI_KEY[] = { &WIFI_KEY[0], NULL };
        esp_efuse_read_field_blob(ESP_EFUSE_WIFI_KEY, &efuse_data, sizeof(efuse_data) * 8);

        // Create copies of the default configs that we can modify
        char config_buf[4096];
        char wsec_buf[512];
        strlcpy(config_buf, default_config, sizeof(config_buf));
        strlcpy(wsec_buf, default_wsec, sizeof(wsec_buf));

        // Grab our mac address and build the local name off it
        char myName[16];
        WiFi.macAddress(mac);
        snprintf(myName, sizeof(myName), "borealis-%02X%02X%02X", mac[3], mac[4], mac[5]);

        // Replace the hostname placeholder with our unique name
        char *hostname_pos;
        while ((hostname_pos = strstr(config_buf, "borealis-XXXXXX")) != NULL) {
            memcpy(hostname_pos, myName, strlen(myName));
        }
       
        // Replace the wifi key placeholder
        char *key_pos = strstr(wsec_buf, "YYYYYYYY");
        if (key_pos != NULL) {
            memcpy(key_pos, efuse_data, 8);
        }

        // Write all config files
        File preset_f = WLED_FS.open("/lastpreset.txt", "w");
        preset_f.print("1");
        preset_f.close();

        File cfg_f = WLED_FS.open("/cfg.json", "w");
        cfg_f.write((const uint8_t*)config_buf, strlen(config_buf));
        cfg_f.close();

        File presets_f = WLED_FS.open("/presets.json", "w");
        presets_f.write((const uint8_t*)default_presets, strlen(default_presets));
        presets_f.close();

        File wsec_f = WLED_FS.open("/wsec.json", "w");
        wsec_f.write((const uint8_t*)wsec_buf, strlen(wsec_buf));
        wsec_f.close();
        
        File ledmap_f = WLED_FS.open("/2d-gaps.json", "w");
        ledmap_f.write((const uint8_t*)default_gaps, strlen(default_gaps));
        ledmap_f.close();

        esp_restart();
    }

    void connected() {

    }

    void loop() {
      // If the preset isn't the one we last saved, or it last changed more than 10 seconds ago
      if (currentPreset != preset_saved && (millis() - preset_last_changed) > 10000) {
        File f = WLED_FS.open("/lastpreset.txt", "w");
        f.print(currentPreset);
        Serial.print("Borealis -- Saved position: ");
        Serial.println(currentPreset);
        f.close();
        preset_saved = currentPreset;
        
        // Update the group preset tracking
        group_presets[preset_group] = currentPreset;
      }

      // Apply brightness if settings changed
      if (brightnessChanged) {
        bri = brightness_values[brightness_index];
        strip.setBrightness(bri);
        brightnessChanged = false;
      }

      // Save gain if it hasn't changed for 10 seconds
      static uint8_t last_input_level = inputLevel;
      if (inputLevel != last_input_level && (millis() - gain_last_changed) > 10000) {
        File f = WLED_FS.open("/gain.txt", "w");
        f.print(inputLevel);
        Serial.print("Borealis -- Saved gain: ");
        Serial.println(inputLevel);
        f.close();
        last_input_level = inputLevel;
        gain_last_changed = millis();
      }

      // If the gain doesn't match what's saved, set it back. (Needed to set it properly after startup)
      if (inputLevel == 128 && loaded_gain_value != 128) {
        inputLevel = loaded_gain_value;
        Serial.print("Borealis -- Restored gain to saved value: ");
        Serial.println(inputLevel);
      }

      return;
    }

    bool handleButton(uint8_t b) {
      yield();
      if ( b != 0) { return false; }

      unsigned long now = millis();
      bool doublePress = buttonWaitTime[b];

      if (isButtonPressed(b)) { // pressed

        if (!buttonPressedBefore[b]) {
          // This counter loops, used for the brightness cycling
          buttonPressedTime[b] = now;
          // This counter goes forever, used for the AP + Factory reset
          buttonPressedTimeStart = now;
        }

        buttonPressedBefore[b] = true;

        if (!doublePress && now - buttonPressedTime[b] > WLED_LONG_PRESS) { // Long Press
          Serial.println("Borealis -- Long - Cycle Brightness");
          brightness_index = (brightness_index + 1) % BRIGHTNESS_COUNT;
          bri = brightness_values[brightness_index];
          strip.setBrightness(bri);
          buttonPressedTime[b] = now;
          buttonLongPressed[b] = true;
        }
          
        if (doublePress && now - buttonPressedTimeStart > WLED_LONG_FACTORY_RESET ) { // Double press + hold more
            Serial.println("Borealis -- Double Super Long - Factory reset");
            nvs_flash_erase();
            WLED_FS.format();
            esp_restart();
        }

      } else if (!isButtonPressed(b) && buttonPressedBefore[b]) { // Released
        long dur = now - buttonPressedTime[b];

        // released after rising-edge short press action
        if (macroButton[b] && macroButton[b] == macroLongPress[b] && macroButton[b] == macroDoublePress[b]) {
          if (dur > WLED_DEBOUNCE_THRESHOLD) buttonPressedBefore[b] = false; // debounce, blocks button for 50 ms once it has been released
          return true;
        }

        if (dur < WLED_DEBOUNCE_THRESHOLD) {buttonPressedBefore[b] = false; return true;} // too short "press", debounce
        buttonWaitTime[b] = 0;

        if (!buttonLongPressed[b]) { // Double press
            if (doublePress) {
                Serial.println("Borealis -- Double tap - Change group");
                // Store current preset in current group
                group_presets[preset_group] = currentPreset;
                
                // Try up to 3 times to find a valid group
                for (int i = 0; i < 3; i++) {
                    preset_group += 1;
                    if (preset_group > 2) { preset_group = 0; }
                    
                    // Try to load the saved preset for this group
                    currentPreset = group_presets[preset_group];
                    if (!presetExists(currentPreset)) {
                        // If saved preset doesn't exist, start at beginning of group
                        currentPreset = (preset_group * 100) + 1;
                    }
                    
                    // Verify the preset exists before applying
                    if (presetExists(currentPreset)) {
                        applyPreset(currentPreset);
                        preset_last_changed = millis();
                        break;
                    }
                }
            } else {
                buttonWaitTime[b] = now;
            }
        }

        buttonPressedTime[b] = false;
        buttonPressedBefore[b] = false;
        buttonLongPressed[b] = false;
      }

      //if 350ms elapsed since last short press release it is a short press
      if (buttonWaitTime[b] && now - buttonWaitTime[b] > WLED_DOUBLE_PRESS && !buttonPressedBefore[b]) {
        buttonWaitTime[b] = 0;
        Serial.println("Borealis -- Short - Change preset");
        currentPreset += 1;
        if (!presetExists(currentPreset)) {
          Serial.println("Looping preset");
          currentPreset = 1 + (preset_group * 100);
        }
        preset_last_changed = millis();
        applyPreset(currentPreset);
      }
      
      return true;
    }
  
    bool presetExists(int preset) {
        StaticJsonDocument<64> doc;
        if (readObjectFromFileUsingId("/presets.json", preset, &doc)) {
          return true;
        } else {
          return false;
        }
    }

    void onStateChange(uint8_t mode) {
    }

    uint16_t getId()
    {
      return USERMOD_ID_BOREALIS;
    }

};
