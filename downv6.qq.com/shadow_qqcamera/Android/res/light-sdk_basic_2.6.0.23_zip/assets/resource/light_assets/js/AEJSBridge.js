//定义Resource类
class Resource {
    constructor(path) {
        this.path = path;
        this.key = "";
    }
}

/*
    AEJSBridge.js 需要是一个辅助js文件，方便上层做一个简单的触发事件
    global.template对象是一个素材对象，素材相关的数据都应该挂在template对象内，方便清除
*/

// 给Entity引入getEntity方法
(function () {
    // SWIG在JSC和V8引擎平台上绑定出来的对象的prototype行为不一致
    if (light.EntityManager.prototype === undefined) {
        // JavaScriptCore
        light.EntityManager.prototype = Object.getPrototypeOf(new light.EntityManager(new light.EventManager()));
    } else {
        // V8
        light.EntityManager.prototype = Object.getPrototypeOf(light.EntityManager.prototype);
    }

    light.EntityManager.prototype.getEntity = function (entityId) {
        let entityIdentifierList = this.entitiesWithComponents("EntityIdentifier");
        for (let i = 0; i < entityIdentifierList.size(); i++) {
            let entity = entityIdentifierList.get(i);
            entity.entityId = entityId;
            if (light._getComponent(entity, "EntityIdentifier").id === entityId) {
                return entity;
            }
        }
    }
}())

// 定义一些常量
const JS_AI_DATA_REQUIRE_SMILE = "Smile";                // 微笑
const JS_AI_DATA_REQUIRE_POUT = "Pout";                  // 嘟嘟嘴
const JS_AI_DATA_REQUIRE_AGE = "Age";                    // 年龄
const JS_AI_DATA_REQUIRE_GENDER = "Gender";              // 性别
const JS_AI_DATA_REQUIRE_HAND_GESTURE = "Hand_Gesture";  // 手势检测
const JS_AI_DATA_REQUIRE_EXPRESSION = "Expression";      // 表情检测
const JS_AI_DATA_REQUIRE_BODY_GESTURE = "Body_Gesture";  // 人体检测
const JS_AI_DATA_REQUIRE_FACE_POINT = "Face_Point";      // 人脸点
const JS_AI_DATA_REQUIRE_HAND_POINT = "Hand_Point";      // 手势点
const JS_AI_DATA_REQUIRE_BODY_POINT = "Body_Point";      // 身体点
const JS_AI_DATA_REQUIRE_CAT_POINT = "Cat_Point";        // 猫脸点
const JS_AI_DATA_REQUIRE_FACE_CLASSIFY = "Face_Classify";        // 敏感人物检测
const JS_AI_DATA_REQUIRE_EMOTION_DETECT = "Emotion_Detect";      //  情绪检测

// 默认美的EntityId
const BASIC_BEAUTY_CAMERA = -1024;
const BASIC_SMOOTH = -1025;
const BASIC_STRETCH = -1026;
const BASIC_LIQUIFY = -1027;
const BASIC_BODY = -1028;
const BASIC_LUT = -1029;
const BASIC_BEAUTY = -1030;

// 获取global对象
var global = global || (function () {
    return this;
}());

// 绑定 ai事件 与 额外响应的方法
function bindCallbackWithAIEvent(f, eventName) {
    // 需要存在template对象
    if (!global.template) {
        return;
    }
    if (!global.template.mapOfCallbackAndEvent) {
        global.template.mapOfCallbackAndEvent = {};
    }
    if (global.template.mapOfCallbackAndEvent[eventName]) {
        global.template.mapOfCallbackAndEvent[eventName].push(f);
    } else {
        global.template.mapOfCallbackAndEvent[eventName] = [f];
    }
}

// 根据某个事件, 触发注册进来的事件回调
function TriggerEvent(eventName, params, entityManager, eventManager, currentTime) {
    if (!global.template) {
        console.log("js log: has no global.template when TriggerEvent(" + eventName + ", " + JSON.stringify(params) + ")");
        return;
    }
    console.log("js log: TriggerEvent(" + eventName + ", " + JSON.stringify(params) + ")");
    // 如果有触发绑定的, 则直接
    if (global.template.mapOfCallbackAndEvent && global.template.mapOfCallbackAndEvent[eventName]) {
        global.template.mapOfCallbackAndEvent[eventName].forEach(function (callback) {
            callback(params, entityManager, eventManager, currentTime);
        });
    }
    // 并且老的素材脚本订阅了某个事件
    if (global.template[eventName]) {
        global.template[eventName](params, entityManager, eventManager, currentTime);
    }
}

// 字符串转大写
function Capitalize(string) {
    let str = string.toLowerCase();
    str = str.replace(/^\S/, s => s.toUpperCase());
    return str;
}

// 获取点位数据
function GetAIPointDataThenFlushToJS(entityManager, eventManager, currentTime,scriptComponent) {
    if (scriptComponent.aiRequire.isEmpty()) {
        return;
    }
    for (let i = 0; i < scriptComponent.aiRequire.size(); i++) {
        let aiKey = scriptComponent.aiRequire.get(i);
        if (aiKey == JS_AI_DATA_REQUIRE_FACE_POINT
            || aiKey == JS_AI_DATA_REQUIRE_HAND_POINT
            || aiKey == JS_AI_DATA_REQUIRE_BODY_POINT
            || aiKey == JS_AI_DATA_REQUIRE_CAT_POINT) {
            let pointData = light.AIDataUtils.GetAIPointDataFromAIDataCenter(entityManager, aiKey);
            let pointArray = [];
            // 转换数据, pointData 是非标准array
            for (let i = 0; i < pointData.size(); i++) {
                let point = pointData.get(i);
                pointArray.push(point);
            }
            let params = {};
            params[aiKey] = pointArray;
            TriggerEvent("onAIDataRequire", params, entityManager, eventManager, currentTime,);
        }
    }
}

// 获取分类数据
function GetAIClassDataThenFlushToJS(entityManager, eventManager, currentTime, scriptComponent) {
    if (scriptComponent.aiRequire.isEmpty()) {
        return;
    }
    for (let i = 0; i < scriptComponent.aiRequire.size(); i++) {
        let aiKey = scriptComponent.aiRequire.get(i);
        if (aiKey == JS_AI_DATA_REQUIRE_HAND_GESTURE
            || aiKey == JS_AI_DATA_REQUIRE_BODY_GESTURE
            || aiKey == JS_AI_DATA_REQUIRE_EXPRESSION
            || aiKey == JS_AI_DATA_REQUIRE_SMILE
            || aiKey == JS_AI_DATA_REQUIRE_AGE
            || aiKey == JS_AI_DATA_REQUIRE_POUT
            || aiKey == JS_AI_DATA_REQUIRE_FACE_CLASSIFY
            || aiKey == JS_AI_DATA_REQUIRE_EMOTION_DETECT) {
            let eventList = light.AIDataUtils.GetJsEventListFromAIDataCenter(entityManager, aiKey);
            let keys = eventList.getKeys();
            for (let i = 0; i < keys.size(); i++) {
                let key = keys.get(i);
                // 解析字符串类型的参数
                let value = JSON.parse(eventList.get(key));
                TriggerEvent(key, value, entityManager, eventManager, currentTime);
            }
        }else if (aiKey == JS_AI_DATA_REQUIRE_GENDER) {
            /*
                GENDER有一段特殊逻辑需要处理，为了兼容素材里的美妆
             */
            let eventList = light.AIDataUtils.GetJsEventListFromAIDataCenter(entityManager, aiKey);
            let keys = eventList.getKeys();
            let size = keys.size();
            if (size == 1) {
                let key = keys.get(0);
                // 解析字符串类型的参数
                let value = JSON.parse(eventList.get(key));
                TriggerEvent(key, value, entityManager, eventManager, currentTime);
            } else if (size == 2) {
                // 如果是2的情况，必定是onMale / onFemale
                // 需要先触发male
                let maleValue = JSON.parse(eventList.get("onMale"));
                TriggerEvent("onMale", maleValue, entityManager, eventManager, currentTime);
                // 再触发female
                let femaleValue = JSON.parse(eventList.get("onFemale"));
                TriggerEvent("onFemale", femaleValue, entityManager, eventManager, currentTime);
            }
        }
    }
}

// 在ScriptSystem.cpp的configure函数内会调用该函数
light.configure = function (entityManager, eventManager, scriptSystem) {
    light._entityManager = entityManager;
    // setup global.resourcePool
    if (global.resourcePool) {
        let inputSourcesString = light.AIDataUtils.GetDataFromDataCenter(entityManager, "inputSources");
        let inputSources = JSON.parse(inputSourcesString);
        for ([sticker, content] of Object.entries(global.resourcePool)) {
            for ([key, info] of Object.entries(inputSources)) {
                if (info.path === content.path) {
                    content.key = info.key;
                    break;
                }
            }
        }
    }

    // 触发老素材的onTemplateInit事件
    if (global.template) {
        // open ai , get the specified entity or component, set the value
        global.template.onTemplateInit(entityManager, eventManager);
    }
}

// 在ScriptSystem.cpp的update函数内会调用该函数
light.update = function (deltaTime, entityManager, eventManager) {
    // 需要存在template对象
    if (!global.template) {
        return;
    }
    // 获取脚本Entity， entityList不是一个标准的Array
    let entityList = entityManager.entitiesWithComponents("Script");
    // 先分别触发点位 / 分类信息
    for (let i = 0; i < entityList.size(); i++) {
        let sEntity = entityList.get(i);
        let sComponent = light._getComponent(sEntity, "Script");
        // 过滤掉被关闭的component
        if (!sComponent.enabled) {
            continue;
        }
        // 从AIDataCenter里获取 point 信息，并包装成OnAIDataRequire事件，发射到JS
        GetAIPointDataThenFlushToJS(entityManager, eventManager, deltaTime / 1000, sComponent);
        // 从AIDataCenter里获取 class 信息，并包装成AI事件，发射到JS
        GetAIClassDataThenFlushToJS(entityManager, eventManager, deltaTime / 1000, sComponent);
        TriggerEvent("onFrameUpdate", deltaTime / 1000, entityManager, eventManager, deltaTime / 1000);
    }
}

light.receive = function (event) {
    // 需要存在template对象
    if (!global.template) {
        return;
    }
    if (event.type() === "CustomDataEvent") {
        console.log("js log: receive event '" + event.event_type + "', and param is " + event.json_data);
        // 兼容老的onMusicData事件
        if (event.event_type == "RhythmEvent" && global.template && global.template.onMusicData) {
            global.template.onMusicData(JSON.parse(event.json_data));
        }
        // 兼容老的onInputEvent事件
        if (event.event_type == "UpdateInputEvent" && global.template && global.template.onInputEvent) {
            global.template.onInputEvent(JSON.parse(event.json_data));
        }
    }
}

// 在ScriptSystem.cpp的析构函数内会调用该函数
light.dealloc = function () {
    // 需要存在template对象
    if (!global.template) {
        return;
    }
}

// 获取指定entity内component的方法
light._getComponent = function (entity, type) {
    if (!entity.hasComponent(type)) {
        return undefined;
    }
    return entity["get" + type + "Component"]();
}

// 以entityId为key， componentList为value
light._mapOfExpandedComponent = light._mapOfExpandedComponent || (function () {
    return {};
}());

light.getComponent = function (entity, type) {
    let component = light._getComponent(entity, type);
    // 遇到问题了则继续返回
    if (component == undefined) {
        return undefined;
    }
    // 如果当前entity包含FaceTracking
    let faceTracking = light._getComponent(entity, "FaceTracking");
    if (faceTracking == undefined) {
        return component;
    }
    // console.log("js log: faceTracking is find in entity " + entity.entityId);
    // 如果_entityManager出问题了，则直接返回
    if (!light._entityManager) {
        return component;
    }
    // console.log("js log: start to expand entity " + entity.entityId);
    // 则需要扩展成5个
    for (let i = 0; i < faceTracking.faceIndex.size(); i++) {
        let newId = i * 10000 + entity.entityId;
        let newEntity = light._entityManager.getEntity(newId);
        if (newEntity) {
            // console.log("js log: find new entity " + newId);
            let newComponent = light._getComponent(newEntity, type);
            if (newComponent) {
                // console.log("js log: find new component " + newComponent.entityId);
                if (!light._mapOfExpandedComponent[entity.entityId]) {
                    light._mapOfExpandedComponent[entity.entityId] = [];
                }
                light._mapOfExpandedComponent[entity.entityId].push(newComponent);
                // console.log("js log: push new component into array");
            }
        }
    }

    let proxy = new Proxy(component, {
        //给set方法增加钩子
        set: light._handlerForComponent,
        get: function (obj, prop) {
            if (prop === "type") {
                return obj.type();
            }else {
                return prop in obj ? obj[prop] : undefined;
            }
        }
    });
    return proxy;
}

light._handlerForComponent = function(obj, prop, value) {
    // 从map里找到对应的列表
    // console.log("js log:  start _handlerForComponent and entityId is " + obj.entityId)
    let list = light._mapOfExpandedComponent[obj.entityId];
    if (list) {
        list.forEach(function (item) {
            // console.log("js log:  item in map is " + JSON.stringify(item))
            // 使用前是否需要判断合法？
            // let entity = light._entityManager.getEntity(item.entityId);
            // if (entity){}
            item[prop] = value;
        });
    }else {
        obj[prop] = value;
    }
}

// 关闭默认美
light._disableDefaultBeauty = function (beautyEntityIdArray) {
    if (!light._entityManager) {
        return;
    }
    if (!Array.isArray(beautyEntityIdArray) || beautyEntityIdArray.length == 0) {
        return;
    }
    beautyEntityIdArray.forEach(function (beautyEntityId) {
        let entity = light._entityManager.getEntity(beautyEntityId);
        if (entity) {
            let st = light._getComponent(entity, "ScreenTransform");
            if (st) {
                st.objectEnabled = false;
            }
        }
    });
}

function isArrayEqual(list1, list2) {
    if (!list1 || !list2) {
        return false;
    }
    if (list1.length != list2.length) {
        return false;
    }
    for (let i = 0; i < list1.length; i++) {
        if (list1[i] != list2[i]) {
            return false;
        }
    }
    return true;
}
