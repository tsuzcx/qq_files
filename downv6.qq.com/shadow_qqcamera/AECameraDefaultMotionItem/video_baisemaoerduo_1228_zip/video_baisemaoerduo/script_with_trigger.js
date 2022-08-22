
(function () {
    //定义素材对象
    var global = global || (function () {
        return this;
    }());
    var template = {};
    global.template = template;
    template.hasBlinkEye = false;
    template.blinkEyeTime = -1;

    var resourcePool = {
        "baierduo": new Resource("baierduo.pag"),
        "baisaihong": new Resource("baisaihong.pag"),
        "baiweiba": new Resource("baiweiba.pag"),
        "baiyanjiaochufa": new Resource("baiyanjiaochufa.pag"),
        "qingwa": new Resource("qingwa.png"),
    };
    global.resourcePool = resourcePool;

    template.onTemplateInit = function (entityManager, eventManager) {
        template.script_component_1 = light.getComponent(entityManager.getEntity(23), "Script");

        let aiRequire = new light.VectorString();
        aiRequire.add("Expression");
        template.script_component_1.aiRequire = aiRequire;

        eventManager.emit(new light.ScriptOpenAIEvent(entityManager, aiRequire));

        template.baiyanjiaochufa_Image = light.getComponent(entityManager.getEntity(22), "Image");
        template.baiyanjiaochufa_Image.enabled = false;
    }

    // 眨眼触发
    template.onBlinkeye = function () {
        if (!template.hasBlinkEye) {
            template.hasBlinkEye = true
        }
    }

    // 时间触发
    template.onFrameUpdate = function (currentTime, entityManager, eventManager) {

        if (template.hasBlinkEye && (template.blinkEyeTime == -1)) {
            // 记录眨眼触发的时间点
            template.blinkEyeTime = currentTime;
            // 眨眼触发时，播放动画
            template.baiyanjiaochufa_Image.enabled = true;
            template.baiyanjiaochufa_Image.src = global.resourcePool.baiyanjiaochufa.key;
            eventManager.emit(new light.ResetPagEvent(global.resourcePool.baiyanjiaochufa.key, currentTime * 1000, entityManager));
        }

        // 眨眼触发时，播放动画结束，重置状态
        if (template.blinkEyeTime != -1 && (currentTime - template.blinkEyeTime) > 1000) {
            template.baiyanjiaochufa_Image.enabled = false;
            template.blinkEyeTime = -1;
            template.hasBlinkEye = false;
        }

    }

}
());