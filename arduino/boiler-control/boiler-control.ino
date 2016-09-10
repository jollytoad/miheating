#include <SPI.h>
#include <FastLED.h>
#include <avr/wdt.h>

const unsigned int on[] = {
0,479,
958,1520,
2000,2541,
3062,3583,
4062,4583,
5083,5625,
6125,7166,
8687,9770,
10729,11270,
11750,12312,
12791,13854,
14333,14875,
15875,16416,
16916,17437,
17937,19000,
19979,20520,
21000,21562,
22041,22562,
23083,23604,
24104,25145,
26270,26687,
27187,27708,
28208,28750,
29333,30312,
31270,31833,
32312,32979,
33354,33875,
34375,35416,
35979,36479,
65534,65535
};

const unsigned int off[] = {
0,500,
958,1500,
1979,2541,
3020,3583,
4041,4583,
5062,5645,
6104,7166,
8687,9729,
10750,11270,
11770,12291,
12791,13854,
14354,14854,
15895,16416,
16937,17437,
17958,18979,
20000,20500,
21020,21541,
22062,22562,
23083,23604,
24125,24625,
25145,25645,
26166,26687,
27229,27708,
28229,28729,
29291,29770,
30312,30791,
31312,31812,
32333,32875,
33375,33875,
34395,35416,
35979,36437,
65534,65535
};

// RGB LEDs
const int rLED[] = { 3, 9 };
const int gLED[] = { 5, 10 };
const int bLED[] = { 6, 11 };

#define heatLED 13

#define tx 4
#define go 8
#define DEBUG true

const unsigned long debounce = 3000000;

bool heat = false;
bool transmit = false;
unsigned long started = debounce;
unsigned int edgeIndex = 0;
unsigned long nextEdgeTime = 0;
unsigned int len = 0;
unsigned long lastTransmit = 0;

#define REPEATS 3
#define REGULAR_GAP 60000000
#define TEST_GAP 5000000
#define REPEAT_GAP 1000000

unsigned int repeat = REPEATS;
unsigned long reTransmitPeriod = REGULAR_GAP;
bool test_mode = false;

unsigned long lastIncoming = 0;
#define HEART_BEAT 180000

#define TEMP_MIN 15
#define TEMP_MAX 26
#define TEMP_MIN_HUE 160
#define TEMP_MAX_HUE 1
#define TEMP_LED 1
#define IND_LED  0
#define LO 0
#define HI 1
uint8_t tempHue[2] = { 0, 0 };
uint8_t tempPulse = 0;
unsigned long tempPulseNextInc = 0;
#define TEMP_PULSE_GAP 20000

void setup() {
  Serial.begin(9600);

  if (DEBUG) {
    Serial.println("started");
  }

  pinMode(tx, OUTPUT);
  digitalWrite(tx, LOW);

  pinMode(heatLED, OUTPUT);
  digitalWrite(heatLED, HIGH);

  pinMode(go, INPUT_PULLUP);

  if (DEBUG) {
    Serial.println("usb enabled");
  }

  wdt_enable(WDTO_8S);
  if (DEBUG) {
    Serial.println("watchdog timer enabled");
  }

  cycleRGB();
  clearRGB(); delay(333);
  digitalWrite(heatLED, LOW);
}

void loop() {
  const unsigned long now = micros();

  // Stop resetting the watchdog timer if we haven't received an incoming message for a while
  if (millis() < lastIncoming + HEART_BEAT) {
    wdt_reset();
  }
  
  if (transmit) {
    if (now >= nextEdgeTime) {
      writeEdge();
    }
  } else {
    if (!digitalRead(go) && now >= started+debounce) {
      heat = !heat;
      startTx(true);
    } else {
      usb();
    }
    
    if (now >= lastTransmit+reTransmitPeriod) {
      startTx(false);
    }
  }

  if (now >= tempPulseNextInc) {
    updateTempPulse();
  }
}

void updateTempPulse() {
  tempPulse++;
  tempPulseNextInc = micros() + TEMP_PULSE_GAP;
  const uint8_t wave = cubicwave8(tempPulse);
  if (tempHue[0] == 0 || tempHue[1] == 0) {
    showRGB(TEMP_LED, CRGB::Pink);
  } else {
    const uint8_t hue = scale8(wave, tempHue[0]-tempHue[1])+tempHue[1];
    showRGB(TEMP_LED, CHSV(hue, 255, 255));
  }
  if (!transmit) {
    showRGB(IND_LED, heat ? CHSV(scale8(wave, 40)+10, 255, 255) : CHSV(96, 255, scale8(wave, 100)+40));
  }
}

void showRGB(const int led, const CRGB& rgb) {
  analogWrite(rLED[led], 255 - rgb.r );
  analogWrite(gLED[led], 255 - rgb.g );
  analogWrite(bLED[led], 255 - rgb.b );
}

void cycleRGB() {
  for (int h = 0; h <= 255; h++) {
    showRGB(LO, CHSV(h, 255, 255));
    showRGB(HI, CHSV(h, 255, 255));
    delay(10);
  }
}

void clearRGB() {
  showRGB(LO, CRGB::Black);
  showRGB(HI, CRGB::Black);
}

uint8_t temperatureToHue(int temperature) {
  return map(constrain(temperature, TEMP_MIN, TEMP_MAX), TEMP_MIN, TEMP_MAX, TEMP_MIN_HUE, TEMP_MAX_HUE);
}

void setTemp(const int n, const int t) {
  tempHue[n] = temperatureToHue(t);
  if (DEBUG) {
    Serial.print("Set temperature ");
    Serial.print(n);
    Serial.print(" to ");
    Serial.print(t);
    Serial.println(" deg.C");
  }
}

void usb() {
  if (Serial.available() > 0) {
    startIncoming();

    boolean newHeat = heat;

    while(Serial.available() > 0) {
      int c = Serial.read();

      if (c == '1') {
        newHeat = true;
      } else if (c == '0') {
        newHeat = false;
      } else if (c == 't') {
        test_mode = true;
      } else if (c == 'n') {
        test_mode = false;
      } else if (c == 'l') {
        setTemp(LO, Serial.parseInt());
      } else if (c == 'h') {
        setTemp(HI, Serial.parseInt());
      }
    }

    endIncoming(newHeat);
  }
}

void startIncoming() {
  lastIncoming = millis();

  if (DEBUG) {
    Serial.println("start incoming");
  }
}

void endIncoming(boolean newHeat) {
    if (DEBUG) {
      Serial.println("end incoming");
    }

    if (newHeat != heat) {
      heat = newHeat;
      startTx(true);
    }
}

void startTx(bool reset) {
  if (DEBUG) {
    Serial.println(heat ? "Heat On" : "Heat Off");
  }
  if (reset) {
    repeat = REPEATS;
  }
  transmit = true;
  edgeIndex = 0;
  len = heat ? sizeof(on) : sizeof(off);
  showRGB(IND_LED, CRGB::White);
  started = micros();
  setNextEdge();
}

void writeEdge() {
  digitalWrite(tx, edgeIndex % 2 ? LOW : HIGH);
  edgeIndex++;
  transmit = edgeIndex < len;
  if (transmit) {
    setNextEdge();
  } else {
    if (--repeat > 0) {
      reTransmitPeriod = REPEAT_GAP;
    } else {
      repeat = REPEATS;
      reTransmitPeriod = test_mode ? TEST_GAP : REGULAR_GAP;
    }
    digitalWrite(heatLED, heat ? HIGH : LOW);
    lastTransmit = micros();
  }
}

long setNextEdge() {
  nextEdgeTime = started + (heat ? on[edgeIndex] : off[edgeIndex]);
}

