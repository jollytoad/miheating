#include <SPI.h>
#include <Ethernet.h>
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

byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED };

IPAddress ip(192, 168, 1, 123);

EthernetServer server(80);

String HTTP_line;

#define heatLED 13
#define txLED 9
#define netLED 7

#define tx 4
#define go 6
#define HTTP false
#define USB true
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

void setup() {
  if (DEBUG || USB) {
    Serial.begin(9600);
  }

  if (DEBUG) {
    Serial.println("started");
  }

  // Disable SD card
  pinMode(4, OUTPUT);
  digitalWrite(4, HIGH);

  pinMode(tx, OUTPUT);
  digitalWrite(tx, LOW);

  pinMode(heatLED, OUTPUT);
  digitalWrite(heatLED, HIGH);

  pinMode(txLED, OUTPUT);
  digitalWrite(txLED, HIGH);

  pinMode(netLED, OUTPUT);
  digitalWrite(netLED, HIGH);

  pinMode(go, INPUT_PULLUP);

  if (HTTP) {
    Ethernet.begin(mac, ip);
    server.begin();

    if (DEBUG) {
      Serial.print("server is at ");
      Serial.println(Ethernet.localIP());
    }
  }

  if (USB && DEBUG) {
    Serial.println("usb enabled");
  }

  digitalWrite(heatLED, LOW);
  digitalWrite(txLED, LOW);
  digitalWrite(netLED, LOW);

  wdt_enable(WDTO_8S);
  if (DEBUG) {
    Serial.println("watchdog timer enabled");
  }
}

void loop() {
  // Stop resetting the watchdog timer if we haven't received an incoming message for a while
  if (millis() < lastIncoming + HEART_BEAT) {
    wdt_reset();
  }
  
  if (transmit) {
    if (micros() >= nextEdgeTime) {
      writeEdge();
    }
  } else {
    if (!digitalRead(go) && micros() >= started+debounce) {
      heat = !heat;
      startTx(true);
    } else {
      if (HTTP) {
        http();
      }
      if (USB) {
        usb();
      }
    }
    
    if (micros() >= lastTransmit+reTransmitPeriod) {
      startTx(false);
    }
  }
}

void http() {
  EthernetClient client = server.available();

  if (client) {
    startIncoming();

    // an http request ends with a blank line
    boolean currentLineIsBlank = true;
    boolean firstLine = true;
    boolean newHeat = heat;
    HTTP_line = "";

    while (client.connected()) {
      if (client.available()) {
        char c = client.read();

        if (firstLine) {
          HTTP_line += c;
        }

        if (DEBUG) {
          Serial.write(c);
        }

        // if you've gotten to the end of the line (received a newline
        // character) and the line is blank, the http request has ended,
        // so you can send a reply
        if (c == '\n' && currentLineIsBlank) {

          // send a standard http response header
          client.println("HTTP/1.1 200 OK");
          client.println("Content-Type: application/json");
          client.println("Connection: close");  // the connection will be closed after completion of the response
          client.println();

          if (HTTP_line.indexOf("GET /on") == 0) {
            newHeat = true;
          } else if (HTTP_line.indexOf("GET /off") == 0) {
            newHeat = false;
          } else if (HTTP_line.indexOf("GET /test") == 0) {
            test_mode = true;
          } else if (HTTP_line.indexOf("GET /normal") == 0) {
            test_mode = false;
          }
          
          client.println(newHeat ? "true" : "false");

          break;
        }
        if (c == '\n') {
          // you're starting a new line
          currentLineIsBlank = true;
          firstLine = false;
        } else if (c != '\r') {
          // you've gotten a character on the current line
          currentLineIsBlank = false;
        }
      }
    }

    // give the web browser time to receive the data
    delay(1);

    // close the connection:
    client.stop();

    endIncoming(newHeat);
  }
}

void usb() {
  if (Serial.available() > 0) {
    startIncoming();

    boolean newHeat = heat;

    while(Serial.available() > 0) {
      int c = Serial.read();

      if (DEBUG) {
        Serial.print(c);
      }

      if (c == '1') {
        newHeat = true;
      } else if (c == '0') {
        newHeat = false;
      } else if (c == 't') {
        test_mode = true;
      } else if (c == 'n') {
        test_mode = false;
      }
    }

    endIncoming(newHeat);
  }
}

void startIncoming() {
  lastIncoming = millis();

  digitalWrite(netLED, HIGH);

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
    } else {
      digitalWrite(netLED, LOW);
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
  started = micros();
  setNextEdge();
}

void writeEdge() {
  digitalWrite(tx, edgeIndex % 2 ? LOW : HIGH);
  digitalWrite(txLED, edgeIndex % 2 ? LOW : HIGH);
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
      digitalWrite(netLED, LOW);
    }
    digitalWrite(heatLED, heat ? HIGH : LOW);
    lastTransmit = micros();
  }
}

long setNextEdge() {
  nextEdgeTime = started + (heat ? on[edgeIndex] : off[edgeIndex]);
}

