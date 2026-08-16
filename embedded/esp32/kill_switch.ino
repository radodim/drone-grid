#include "sbus.h"
#include "WiFi.h"
#include "esp_wifi.h"
#include "esp_bt.h"

#define OUTPUT_PIN_FOR_SHUTDOWN_SIGNAL 23

#define SHUTDOWN_CHANNEL 9
#define SHUTDOWN_THRESHOLD_VALUE 1000

#define COMPANION_SHUTDOWN_PULSE_MS 200
#define SWITCH_DEBOUNCE_MS 25
#define FAILSAFE_DEBOUNCE_MS 200

#define LINK_LOSS_TIMEOUT_MS 1000

bfs::SbusRx sbus(&Serial2, /*rx=*/16, /*tx=*/17, /*inv=*/true);
bfs::SbusData data;

bool shutdownSignalSent = false;
unsigned long lastValidPacketMs = 0;
bool packetReceived = false;

class SustainedCondition {
  private:
    const unsigned long holdMs;
    unsigned long activeSince = 0;
    bool wasActive = false;

 public:
  explicit SustainedCondition(unsigned long holdMs) : holdMs(holdMs) {}

  bool check(bool condition) {
    if (condition && !wasActive) {
      activeSince = millis();
    }
    wasActive = condition;

    return condition && (millis() - activeSince >= holdMs);
  }

};

SustainedCondition failsafeHold(FAILSAFE_DEBOUNCE_MS);
SustainedCondition switchHold(SWITCH_DEBOUNCE_MS);

void setup() {
  WiFi.mode(WIFI_OFF);
  esp_wifi_stop();
  btStop();

  pinMode(OUTPUT_PIN_FOR_SHUTDOWN_SIGNAL, OUTPUT);
  digitalWrite(OUTPUT_PIN_FOR_SHUTDOWN_SIGNAL, HIGH);

  Serial.begin(115200);
  sbus.Begin();
  Serial.println("SBUS reader started");
}

void loop() {
  if (sbus.Read()) {
    lastValidPacketMs = millis();
    packetReceived = true;
    data = sbus.data();

    if (failsafeHold.check(data.failsafe)) {
      sendShutdownSignalToCompanion("SBUS receiver detected failsafe scenario.");
    }

    if (switchHold.check(data.ch[SHUTDOWN_CHANNEL - 1] > SHUTDOWN_THRESHOLD_VALUE)) {
      sendShutdownSignalToCompanion("Received a signal from the transmitter to shutdown the companion.");
    }
    
    // for (int i = 0; i < bfs::SbusData::NUM_CH; i++) {
    //   Serial.print("CH"); Serial.print(i + 1); Serial.print("=");
    //   Serial.print(data.ch[i]); Serial.print("  ");
    // }
    // Serial.print(" lost="); Serial.print(data.lost_frame);
    // Serial.print(" failsafe="); Serial.println(data.failsafe);
  }

  if (packetReceived && (millis() - lastValidPacketMs >= LINK_LOSS_TIMEOUT_MS)) {
    sendShutdownSignalToCompanion("The receiver stopped receiving data.");
  }
}

void sendShutdownSignalToCompanion(const char* message) {
  if (shutdownSignalSent) 
    return;

  Serial.println(message);
  Serial.println("Shutting down the companion...");
  digitalWrite(OUTPUT_PIN_FOR_SHUTDOWN_SIGNAL, LOW);
  delay(COMPANION_SHUTDOWN_PULSE_MS);
  digitalWrite(OUTPUT_PIN_FOR_SHUTDOWN_SIGNAL, HIGH);
  shutdownSignalSent = true;
  Serial.println("Shutdown signal sent to the companion.");
}