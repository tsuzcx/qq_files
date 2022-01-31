light.execute("light://js/AEJSBridge.js"); (function() {
    var global = global ||
    function() {
        return this
    } ();
    var resourcePool = {};
    global.resourcePool = resourcePool;
    var template = {};
    global.template = template;

    var config = {
        "enable_watermark": true,
        "enable_deblur": true,
        "enable_hdr": true
    };

    var face_config = {
        "detect_frequency": 15,
        "face3d_enabled": false
    };

    var face_config_close = {
        "detect_frequency": 0,
        "face3d_enabled": true
    };

    template.onTemplateInit = function(entityManager, eventManager) {
        // 关闭基础美
        eventManager.emit(new light.AIRequireEvent("FULL_BODY_AGENT","false", entityManager, eventManager));
        light._disableDefaultBeauty([BASIC_STRETCH, BASIC_LIQUIFY, BASIC_SMOOTH, BASIC_BEAUTY, BASIC_BODY, BASIC_LUT]);

        var entityList = entityManager.entitiesWithComponents("AITextureComponent");
        for (var i = 0; i < entityList.size(); i++) {
            var entity = entityList.get(i);
            var name = entity.getComponent("EntityIdentifier").name;
            if (name == "PicEnhance") {
                template.picenhance = entity.getComponent("AITextureComponent");
            }
        }
        //template.picenhance.SetAITextureInputParamsStr(JSON.stringify(config));

        var entityList = entityManager.entitiesWithComponents("GAN");
        for (var i = 0; i < entityList.size(); i++) {
            var entity = entityList.get(i);
            template.faceenhance = entity.getComponent("ScreenTransform");
        }

        template.entityManager = entityManager;
        template.eventManager = eventManager;
        // 设置 face_config
        eventManager.emit(new light.AIRequireEvent("FACE_AGENT","true", entityManager, eventManager, false, JSON.stringify(face_config)));
    };
    template.onFrameUpdate = function(currentTime, entityManager, eventManager) {
    };
    template.onInputEvent = function (params) {
        var watermark_enabled = params["event.script.lightsdk.watermark.enabled"];
        var deblur_enabled = params["event.script.lightsdk.deblur.enabled"];
        var hdr_enabled = params["event.script.lightsdk.hdr.enabled"];
        var delogo_cache_path = params["event.script.lightsdk.watermark.cache_file_path"];

        if (watermark_enabled == "true" || watermark_enabled == true) {
            config["enable_watermark"] = true;
        } else if (watermark_enabled == "false" || watermark_enabled == false) {
            config["enable_watermark"] = false;
        }

        if (deblur_enabled == "true" || deblur_enabled == true) {
            config["enable_deblur"] = true;
        } else if (deblur_enabled == "false" || deblur_enabled == false) {
            config["enable_deblur"] = false;
        }

        if (hdr_enabled == "true" || hdr_enabled == true) {
            config["enable_hdr"] = true;
        } else if (hdr_enabled == "false" || hdr_enabled == false) {
            config["enable_hdr"] = false;
        }
        config["delogo_config_path"] = delogo_cache_path;
        template.picenhance.SetAITextureInputParamsStr(JSON.stringify(config));

        var entityManager = template.entityManager;
        var eventManager = template.eventManager;

        var faceenhance_enabled = params["event.script.lightsdk.faceenhance.enabled"];
        if (faceenhance_enabled == "true" || faceenhance_enabled == true) {
            template.faceenhance.objectEnabled = true;
            eventManager.emit(new light.AIRequireEvent("FACE_AGENT","true", entityManager, eventManager, false, JSON.stringify(face_config)));
            eventManager.emit(new light.AIRequireEvent("GAN_VALIDATOR_AGENT","true", entityManager, eventManager));
        } else if (faceenhance_enabled == "false" || faceenhance_enabled == false) {
            template.faceenhance.objectEnabled = false;
            eventManager.emit(new light.AIRequireEvent("FACE_AGENT","false", entityManager, eventManager, false, JSON.stringify(face_config_close)));
            eventManager.emit(new light.AIRequireEvent("GAN_VALIDATOR_AGENT","false", entityManager, eventManager));
        }
    };

    light.dealloc = function () {
        var entityManager = template.entityManager;
        var eventManager = template.eventManager;
        eventManager.emit(new light.AIRequireEvent("FACE_AGENT","false", entityManager, eventManager, false, JSON.stringify(face_config_close)));
    }
})();