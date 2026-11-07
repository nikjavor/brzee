require 'xcodeproj'
require 'fileutils'

root = File.expand_path('..', __dir__)
output = ARGV.fetch(0, '/tmp/brzee-ui-smoke')
FileUtils.mkdir_p(output)
project = Xcodeproj::Project.new(File.join(output, 'BRZEESmoke.xcodeproj'))
target = project.new_target(:ui_test_bundle, 'BRZEESmoke', :ios, '16.4')
file = project.main_group.new_file(File.join(root, 'tests/e2e/SmokeTests.swift'))
target.add_file_references([file])
target.build_configurations.each do |configuration|
  configuration.build_settings.merge!({
    'PRODUCT_BUNDLE_IDENTIFIER' => 'com.brzee.smoke',
    'GENERATE_INFOPLIST_FILE' => 'YES',
    'SWIFT_VERSION' => '5.0',
    'CODE_SIGNING_ALLOWED' => 'NO',
    'SDKROOT' => 'iphonesimulator',
    'SUPPORTED_PLATFORMS' => 'iphonesimulator',
    'TARGETED_DEVICE_FAMILY' => '1'
  })
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.save_as(project.path, 'BRZEESmoke')
puts project.path
