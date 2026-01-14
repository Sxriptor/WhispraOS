{
  "targets": [
    {
      "target_name": "wasapi_loopback",
      "sources": [ "wasapi_loopback.cc" ],
      "include_dirs": [
        "<!(node -p \"require('node-addon-api').include\")",
        "<(module_root_dir)/node_modules/node-addon-api"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS",
        "WINVER=0x0A00",
        "_WIN32_WINNT=0x0A00",
        "NTDDI_VERSION=0x0A000008" 
      ],
      "libraries": [
        "-lole32",
        "-luuid",
        "-lwinmm",
        "-lavrt",
        "-lmmdevapi"
      ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1,
          "AdditionalOptions": ["/std:c++17"],
          "AdditionalIncludeDirectories": ["$(UniversalCRT_IncludePath)", "$(WindowsSdkDir)Include\\10.0.19041.0\\um", "$(WindowsSdkDir)Include\\10.0.19041.0\\shared"]
        }
      }
    }
  ]
}
