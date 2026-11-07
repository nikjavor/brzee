import XCTest

final class BrzeeSmokeTests: XCTestCase {
  func testProductionStartsDisconnectedWithoutDemo() {
    let app = XCUIApplication(bundleIdentifier: "com.brzee.companion")
    app.launch()
    XCTAssertTrue(app.buttons["Connect to BRZEE"].waitForExistence(timeout: 15))
    XCTAssertFalse(app.buttons["Try Demo"].exists)
    XCTAssertFalse(app.staticTexts["DEMO"].exists)
    XCTAssertFalse(app.staticTexts["LIVE"].exists)
    XCTAssertFalse(app.buttons["Mute sound"].exists)
    let image = XCTAttachment(screenshot: app.screenshot())
    image.name = "BRZEE production connection screen"
    image.lifetime = .keepAlways
    add(image)
  }
}
