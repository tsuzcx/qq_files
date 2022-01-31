
// 加载 AEJSBridge.js
light.execute("light://js/AEJSBridge.js");

(function () {
    //定义素材对象
    var global = global || (function () {
        return this;
    }());
    var template = {};
    global.template = template;
    var resourcePool = {};

    global.resourcePool = resourcePool;

    var snapshot_count = 0;

    template.onTemplateInit = function (entityManager, eventManager) {
        //指定JS需要从AEDataCenter里获取哪些值
        template.bg = light.getComponent(entityManager.getEntity(22), "Image");
        template.bg.enabled = false;
        template.snapshot = light.getComponent(entityManager.getEntity(44), "Snapshot");
        template.snapshot.enabled = false;
        template.RenderTarget_Snapshot_2_Image = light.getComponent(entityManager.getEntity(49), "Image");
        template.RenderTarget_Snapshot_2_Image.enabled = false;
        template.RenderTarget_Segmentation_1_Image = light.getComponent(entityManager.getEntity(35), "Image");
        template.RenderTarget_Segmentation_1_Image.enabled = false;
        template.RenderTarget_Segmentation_1_Mask = light.getComponent(entityManager.getEntity(32), "ScreenTransform");
        template.RenderTarget_Segmentation_1_Mask.enabled = false;

        template.sticker3D = light.getComponent(entityManager.getEntity(71), "Sticker3D");
        template.sticker3D.enabled = false;
    }

    template.onInputEvent = function (params) {
        var shoot = params["event.script.shoot"];
        var triggerState1 = params["event.script.triggerState1"];
        var triggerState2 = params["event.script.triggerState2"];
        // 定格
        if (shoot) {
            template.RenderTarget_Segmentation_1_Image.enabled = false;
            template.RenderTarget_Segmentation_1_Mask.enabled = false;
            template.bg.enabled = false;
            template.snapshot.enabled = true;
            template.RenderTarget_Snapshot_2_Image.enabled = true;
            snapshot_count = 1;
        }
        // 进入小遮罩
        if (triggerState1) {
            template.snapshot.enabled = false;
            template.RenderTarget_Snapshot_2_Image.enabled = false;
            template.RenderTarget_Segmentation_1_Image.enabled = true;
            template.RenderTarget_Segmentation_1_Mask.enabled = true;
            template.bg.enabled = true;
        }
        // 加载3d模型
        if (triggerState2) {
            template.snapshot.enabled = false;
            template.RenderTarget_Snapshot_2_Image.enabled = false;
            // todo 加载3d模型
            template.sticker3D.enabled = true;
        }
    }

    template.onFrameUpdate = function(currentTime, entityManager, eventManager) {

        if (snapshot_count == 1) {
            snapshot_count = 2;
        } else if (snapshot_count == 2) {
            template.snapshot.enabled = false;
            snapshot_count = 0;
        }

        // // 定格
        // if (currentTime < 2000) {
        //     template.RenderTarget_Segmentation_1_Image.enabled = false;
        //     template.bg.enabled = false;
        //     template.snapshot.enabled = true;
        //     template.RenderTarget_Snapshot_2_Image.enabled = true;
        //     snapshot_count++;
        //     if (snapshot_count > 1) {
        //         template.snapshot.enabled = false;
        //     }
        // }
        // // 进入小遮罩
        // if (currentTime >= 2000 && currentTime < 5000) {
        //     template.snapshot.enabled = false;
        //     template.RenderTarget_Snapshot_2_Image.enabled = false;
        //     template.RenderTarget_Segmentation_1_Image.enabled = true;
        //     template.bg.enabled = true;
        // }
        // // 加载3d模型
        // if (currentTime >= 5000) {
        //     template.snapshot.enabled = false;
        //     template.RenderTarget_Snapshot_2_Image.enabled = false;
        //     // todo 加载3d模型
        //     template.sticker3D.enabled = true;
        // }
    }

}
());
