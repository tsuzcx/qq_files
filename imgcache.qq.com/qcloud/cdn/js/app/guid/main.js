/**
* @CDN 域名接入模块
* @author brandonwei
* @update 2016-12-16
*/
define(function(require, exports, module) {
    var $ = require("cdn/$");
    var net = require("cdn/lib/net");
    var Bee = require('qccomponent');
    var dao = require("cdn/data/dao");
    var guidestepTemplate = require("../../templates/guidestep.html.js");
    var tmpl = require("cdn/lib/tmpl");
    var dialog = require("cdn/dialog");
    var router = require("cdn/router");
    var cdnutil = require('cdn/lib/util');
    var tips = require('cdn/tips');
    var yaCdnUtil = require('cdn/util');

    var defaultErrorMsg = "CDN系统正在繁忙中，请休息一下，稍后重试！";
    var Container = '.manage-area';
    var Component = {};
    var checkHostTimeout = [];
    var checkHostXhrs = [];
    var checkContentTimeout = [];
    var checkTimeTimeout = [];
    var checkHostTimeoutOrigin;
    var defaultCheckTimeTimeout;
    var errorTips = {
        "HOST_EMPTY": "请填写加速域名",
        "HOST_FORMAT": "输入合法格式域名，如www.abc.com",
        "HOST_FORMAT_CHN": "暂时不支持中文域名加速",
        "HOST_WILDCARD": "泛域名请单独接入，不可与其他子域名或泛域名一同接入",
        "HOST_EXIST": "该域名已接入",
        "HOST_WILDCARD_EXIST": "泛域名已经接入",
        "HOST_WILDCARD_EXIST_OTHER": "域名对应泛域名已被其他用户接入",
        "HOST_EXIST_DAYU": "该域名已在大禹系统接入",
        "HOST_WILDCARD_EXIST_DAYU": "该泛域名已在大禹系统接入",
        "HOST_EXIST_SELF": "域名已被该账号添加过",
        "HOST_EXIST_OTHER": "域名被他人接入",
        "HOST_NOT_RECORD": "域名未在工信部备案，无法接入",
        "HOST_SP": '该域名为保留域名，您可以<a target="_blank" style="margin: 0px" href="https://console.cloud.tencent.com/workorder/category/create?level1_id=83&level2_id=85&level1_name=存储与CDN&level2_name=内容分发网络%20%20CDN">提交工单</a>进行接入申请',
        "HOST_SP_INNER": '该域名为内部保留域名，您可以<a target="_blank" style="margin: 0px" href="https://console.cloud.tencent.com/workorder/category/create?level1_id=83&level2_id=85&level1_name=存储与CDN&level2_name=内容分发网络%20%20CDN">提交工单</a>进行接入申请',
        "HOST_NOT_AVAILABLE": "该域名暂时不支持接入",
        "HOST_NEED_VERIFY": '该域名需要进行接入审核，请<a target="_blank" style="margin: 0px" href="https://console.cloud.tencent.com/workorder/category/create?level1_id=83&level2_id=85&level1_name=存储与CDN&level2_name=内容分发网络%20%20CDN">提交工单</a>进行接入申请',
        "HOST_BLACKLIST": '该域名已被列入黑名单，您可以<a target="_blank" style="margin: 0px" href="https://console.cloud.tencent.com/workorder/category/create?level1_id=83&level2_id=85&level1_name=存储与CDN&level2_name=内容分发网络%20%20CDN">提交工单</a>进行申诉',
        "HOST_ILLEGAL":'该域名存在非法信息，您可以前往腾讯电脑管家进行申诉',
        "HOST_REPEAT": "域名重复",
    };

    var verifyTips = {
        "HOST_WILDCARD": "该域名为泛域名，请检查域名是否输入正确。",
        "HOST":"该域名已在其他处接入，请检查域名是否输入正确。"
    };
    var verifyResultTips = {
        "FAIL_FILE_NOT_UPLOAD": "验证不成功，请确认是否已经上传正确",
        "FAIL_BANNED": "该域名已经被封禁，暂时不允许取回"
    };

    var originTips = {
        "DEFAULT": "可填写多个源站IP（一行一个，最多32个），或填写一个域名，支持配置端口（0~65535）",
        "DEFAULT_V6": "可填写多个源站IP（一行一个，最多32个），支持配置端口（0~65535），IPv6形式源站地址最多可填充一个",
        "NOT_SUPPORT_V6": "暂不支持 IPv6 源站",
        "V4_BUT_V6": "请勾选 IPv6 回源标记",
        "V6_BUT_DOMAIN": "暂不支持配置域名回源",
        "FORMAT_ERROR": "请输入合法的IP或域名",
        "ORIGIN_ERROR": "源站域名不能与加速域名相同",
        "DOMAINS_OVERFLOW": "请输入一个域名",
        "IP_OVERFLOW": "源站 IP 地址最多可填充32个",
        "IPV6_OVERFLOW": "IPv6 形式源站地址最多可填充一个",
        "WEIGHT_SINGLE": "单个源站不能配置权重",
        "WEIGHT_DOMAIN": "域名暂不支持配置权重",
        "WEIGHT_IPV6": "IPv6 形式的源站暂不支持配置权重",
        "WEIGHT_SOME_IP": "不支持只为部分 IP 配置权重",
        "WEIGHT_OVERFLOW": "权重大小范围[0, 1000]",
    };

    var init = function() {
        Component = Bee.mount($(Container).get(0), {
            $data: {
                hostArray:[{
                    host: "",
                    host_error: false,
                    host_error_tip_show: false,
                    loading: false,
                    success: false,
                    error_tip: errorTips.HOST_EMPTY,
                    verify_show: false,
                    verify_icon: true,
                    verify_tip: verifyTips.HOST,
                    verify_url:"",
                    verify_result: "",
                    verify_result_tip:verifyResultTips.FAIL_FILE_NOT_UPLOAD
                }],
                host: "",
                host_type: "cname",
                service_type: "web",
                project_id: "0",
                overseaProjectId: undefined,
                projectList: [],
                origin: "",
                origin_is_domain: false,
                ipv6: false,
                origin_ip_tip: originTips.DEFAULT,
                origin_format_error: false, // 源站格式错误
                origin_error: "",           // 源站非法
                cos_origin_list: [],
                cos_origin_search_list: [],
                cos_origin: {},
                cos_origin_value:"",
                cos_isv4: undefined,
                cos_bucket_type: 'default',
                cos_bucket_website_open: false,
                cos_bucket_website_error: false,
                cos_has_interface_right: false, // 是否有调用 Bucket 接口的权限
                cos_has_bucket_auth: undefined, // 是否拥有访问 Bucket 的权限
                cos_has_hy_auth: false, // 是否开启私有存储桶访问
                cache_default: {
                    time_error: false,
                    content_error: false,
                    type: 0,
                    content: "all",
                    time: 30,
                    unit: "d"
                },
                cache_custom:[{
                    time_error: false,
                    content_error: false,
                    type: "1",
                    content: ".php;.jsp;.asp;.aspx",
                    time: 0,
                    unit: "s"
                }],
                add_cache_show: true,
                download_url:'https:' + CDN.FormSender.serverUrl + '/ajax/api.php?action=get_test_file&g_tk=' + yaCdnUtil.getACSRFToken(),
                add_show: true,
                origin_cos_error: false,
                furl_cache: false,
                timeMap:{
                    "s": 1,
                    "m": 60,
                    "h": 3600,
                    "d": 86400
                },
                permission: false,
                ftp_permisstion: false,
                select_panel_show: false,
                disable: false,
                fwd_host_type: "default",
                fwd_host: "",
                share_cname: false,
                fwd_host_error: false,
                cache_mode: "simple",
                vip: CDN.base.vip,
                edge_computing: false,
                edge_computing_open: false,
                lua_rule_engine: true,
                support_ipv6: false,
            },

            $afterInit: function() {
                this.$watch('cos_origin_value', function(val) {
                    var cos_origin_search_list = [];
                    this.$data.cos_origin_list.forEach(function(item, index) {
                        if ((item.Name + '（' + item.Location + '）').indexOf(val) > -1 || item.Origin) {
                            cos_origin_search_list.push(item);
                        }
                    });
                    this.$set({cos_origin_search_list: cos_origin_search_list});

                    if (!this.$data.cos_origin.Name) return;
                    if (this.$data.cos_bucket_type === 'website') {
                        var that = this;
                        getBucketWebsiteStatus(this.$data.cos_origin.Name, this.$data.cos_origin.Location).done(function (open) {
                            that.$set({ cos_bucket_website_open: open, cos_bucket_website_error: !open });
                        });
                    }
                });

                this.$watch('host_type', function(val){
                    if (val == "ftp") {
                        if (this.service_type == "media" && this.service_type == "live") {
                            this.cache_custom.splice(0, this.cache_custom.length);
                            this.cache_custom.push({
                                time_error: false,
                                content_error: false,
                                type: "1",
                                content: ".php;.jsp;.asp;.aspx",
                                time: 0,
                                unit: "s"
                            });
                            this.cacheConteneKeyup(0, false);
                            this.cacheTimeKeyup(0, false);
                            this.$set({
                                furl_cache: false,
                                service_type: "web"
                            });
                        }
                        else if (this.service_type == "web") {
                            this.cache_custom.splice(0, this.cache_custom.length);
                        }
                    }
                    if (val === 'cos') {
                        var first = this.$data.cos_origin.Name ? this.$data.cos_origin : this.$data.cos_origin_list[0];
                        this.$set({ furl_cache: true, disable: true, cos_origin_value: first ? (first.Name + '（' + first.Location + '）') : undefined, cos_origin: first });
                        $('[_dn_select_cos_site_type]').prop('disabled', this.$data.cos_isv4);
                    } else {
                        this.$set({ disable: false });
                    }

                });

                this.$watch('service_type', function(val) {
                    if (this.cache_mode == "simple") {
                        var cache_custom = [];
                        if (val == "web") {
                            $('[_dn_cdn_default_time]').val("30");
                            this.cache_default.time = 30;
                            this.cache_custom.splice(0, this.cache_custom.length);
                            this.cache_custom.push({
                                time_error: false,
                                content_error: false,
                                type: "1",
                                content: ".php;.jsp;.asp;.aspx",
                                time: 0,
                                unit: "s"
                            });
                            this.cacheConteneKeyup(0, false);
                            this.cacheTimeKeyup(0, false);
                            if (this.host_type !="cos") {
                                this.$set({furl_cache: false, disable: false});
                            }
                            else {
                                this.$set({furl_cache: false});
                            }
                        }
                        else if (val == "download") {
                            $('[_dn_cdn_default_time]').val("30");
                            this.cache_default.time = 30;
                            this.cache_custom.splice(0, this.cache_custom.length);
                            if (this.host_type !="cos") {
                                this.$set({furl_cache: false, disable: false});
                            }
                            else {
                                this.$set({furl_cache: false});
                            }
                        }
                        else if (val == "live") {
                            $('[_dn_cdn_default_time]').val("0");
                            this.cache_default.time = 0;
                            this.cache_custom.splice(0, this.cache_custom.length);
                            this.$set({furl_cache: false, disable: true});
                        }
                        else {
                            $('[_dn_cdn_default_time]').val("30");
                            this.cache_default.time = 30;
                            this.cache_custom.splice(0, this.cache_custom.length);
                            if (this.host_type !="cos") {
                                this.$set({furl_cache: true, disable: false});
                            }
                            else {
                                this.$set({furl_cache: true});
                            }
                        }
                    }
                });

                this.$watch('cos_bucket_type', function (val) {
                    if (!this.$data.cos_origin.Name) return;
                    if (val === 'website') {
                        var that = this;
                        getBucketWebsiteStatus(this.$data.cos_origin.Name, this.$data.cos_origin.Location).done(function (open) {
                            that.$set({ cos_bucket_website_open: open, cos_bucket_website_error: !open });
                        });
                    } else {
                        this.$set({ cos_bucket_website_error: false });
                    }
                })

                this.$watch('cos_isv4', function (val) {
                    $('[_dn_select_cos_site_type]').prop('disabled', val);
                });

                this.$watch('ipv6', function (val) {
                    if (this.$data.origin.length) this.cnameOriginInput();
                });
            },

            back: function() {
                router.navigate('/cdn/access');
            },
            hostKeyup: function(index) {
                var that = this;
                if (checkHostTimeout[index]) {
                    clearTimeout(checkHostTimeout[index]);
                }
                if (checkHostXhrs) checkHostXhrs[index] = false;

                checkHostTimeout[index] = setTimeout(function() {
                    var hostArray = Component.hostArray;
                    // 如果在debounce的时候，该行被点击删除，则返回
                    if (!hostArray[index]) {
                        return;
                    }
                    var host = $.trim(hostArray[index].host);
                    var isFocus = $('[_dn_cdn_host]').eq(index).is(':focus');
                    var newItem = $.extend({}, hostArray[index]);
                    var chnReg = /[\u4e00-\u9fa5]/g;
                    // 前端校验
                    if (host == "" || !cdnutil.testDomain(host)) {
                        newItem.host = host;
                        if (chnReg.test(host)) {
                            newItem.error_tip = errorTips.HOST_FORMAT_CHN;
                        }
                        else {
                            newItem.error_tip = errorTips.HOST_FORMAT;
                        }
                        newItem.verify_show = false;
                        newItem.success = false;
                        newItem.host_error = true;
                        newItem.host_error_tip_show = true;
                        hostArray.splice(index, 1);
                        hostArray.splice(index, 0, newItem);
                        // 注：经尝试不能 splice(index, 1, newItem)，建议不要改动
                        if (hostArray.length < 10) {
                            Component.$set({
                                add_show: true
                            });
                        }
                        return isFocus && $('[_dn_cdn_host]').eq(index).focus();
                    } else if (_.filter(hostArray, function (item) { return $.trim(item.host) === host }).length > 1) {
                        newItem.host = host;
                        newItem.verify_show = false;
                        newItem.success = false;
                        newItem.host_error = true;
                        newItem.host_error_tip_show = true;
                        newItem.error_tip = errorTips.HOST_REPEAT;
                        hostArray.splice(index, 1);
                        hostArray.splice(index, 0, newItem);
                        if (hostArray.length < 10) {
                            Component.$set({
                                add_show: true
                            });
                        }
                        return isFocus && $('[_dn_cdn_host]').eq(index).focus();
                    }
                    //后端校验
                    newItem.loading = true;
                    newItem.success = false;
                    newItem.host = host;
                    hostArray.splice(index, 1);
                    hostArray.splice(index, 0, newItem);
                    isFocus && $('[_dn_cdn_host]').eq(index).focus();

                    checkHostXhrs[index] = true;
                    checkHost({ host: host, type: "host", check_global: 1 }).done(function(rs) {
                        // 如果在debounce的时候，该行被点击删除，则返回
                        if (!hostArray[index] || !checkHostXhrs[index]) {
                            return;
                        }
                        var isFocus = $('[_dn_cdn_host]').eq(index).is(':focus');
                        newItem.loading = false;
                        // 判断域名项目是否与境外冲突
                        that.$set({
                            overseaProjectId: rs.data.global_host ? rs.data.global_host.project_id : undefined,
                        });

                        // 判断是否泛域名，是则需要显示校验权限的tip
                        if (host.indexOf("*") === 0)
                        {
                            var domain = rs.data.domain
                            newItem.verify_url = 'http://' + domain + '/qcloud_cdn.html';
                            newItem.verify_domain = domain;
                            newItem.verify_show = true;
                            newItem.verify_tip = verifyTips.HOST_WILDCARD;
                            newItem.host_error = true;
                            newItem.host_error_tip_show = false;
                            hostArray.splice(index, 1);
                            hostArray.splice(index, 0, newItem);
                            // 隐藏继续添加按钮
                            Component.$set({
                                add_show: false,
                            });
                        }
                        else {
                            newItem.success = true;
                            newItem.host_error = false;
                            newItem.verify_show = false;
                            hostArray.splice(index, 1);
                            hostArray.splice(index, 0, newItem);
                        }
                        isFocus && $('[_dn_cdn_host]').eq(index).focus();
                    }).fail(function(rs){
                        // 如果在debounce的时候，该行被点击删除，则返回
                        if (!hostArray[index] || !checkHostXhrs[index]) {
                            return;
                        }
                        var isFocus = $('[_dn_cdn_host]').eq(index).is(':focus');
                        var code = rs.code;
                        newItem.loading = false;
                        newItem.host_error = true;
                        newItem.host_error_tip_show = true;
                        newItem.verify_show = false;

                        that.$set({
                            overseaProjectId: undefined,
                        });

                        switch(code) {
                            case 9092:
                                newItem.error_tip = errorTips.HOST_EXIST;
                                hostArray.splice(index, 1);
                                hostArray.splice(index, 0, newItem);
                                isFocus && $('[_dn_cdn_host]').eq(index).focus();
                                break;
                            case 9093:
                                newItem.error_tip = errorTips.HOST_WILDCARD_EXIST_OTHER;
                                hostArray.splice(index, 1);
                                hostArray.splice(index, 0, newItem);
                                isFocus && $('[_dn_cdn_host]').eq(index).focus();
                                break;
                            case 9107:
                                newItem.error_tip = errorTips.HOST_FORMAT;
                                hostArray.splice(index, 1);
                                hostArray.splice(index, 0, newItem);
                                isFocus && $('[_dn_cdn_host]').eq(index).focus();
                                break;
                            case 9141:
                                newItem.error_tip = errorTips.HOST_WILDCARD_EXIST;
                                hostArray.splice(index, 1);
                                hostArray.splice(index, 0, newItem);
                                isFocus && $('[_dn_cdn_host]').eq(index).focus();
                                break;
                            case 9395:
                                newItem.error_tip = errorTips.HOST_EXIST_DAYU;
                                hostArray.splice(index, 1);
                                hostArray.splice(index, 0, newItem);
                                isFocus && $('[_dn_cdn_host]').eq(index).focus();
                                break;
                            case 9142:
                                newItem.error_tip = errorTips.HOST_WILDCARD_EXIST_DAYU;
                                hostArray.splice(index, 1);
                                hostArray.splice(index, 0, newItem);
                                isFocus && $('[_dn_cdn_host]').eq(index).focus();
                                break;
                            case 9137:
                                newItem.error_tip = errorTips.HOST_EXIST_SELF;
                                hostArray.splice(index, 1);
                                hostArray.splice(index, 0, newItem);
                                isFocus && $('[_dn_cdn_host]').eq(index).focus();
                                break;
                            case 20004:
                                newItem.error_tip = errorTips.HOST_NOT_RECORD;
                                hostArray.splice(index, 1);
                                hostArray.splice(index, 0, newItem);
                                isFocus && $('[_dn_cdn_host]').eq(index).focus();
                                break;
                            case 20005:
                                newItem.error_tip = errorTips.HOST_SP;
                                hostArray.splice(index, 1);
                                hostArray.splice(index, 0, newItem);
                                isFocus && $('[_dn_cdn_host]').eq(index).focus();
                                break;
                            case 20006:
                                newItem.error_tip = errorTips.HOST_SP_INNER;
                                hostArray.splice(index, 1);
                                hostArray.splice(index, 0, newItem);
                                isFocus && $('[_dn_cdn_host]').eq(index).focus();
                                break;
                            case 20007:
                                newItem.error_tip = errorTips.HOST_NOT_AVAILABLE;
                                hostArray.splice(index, 1);
                                hostArray.splice(index, 0, newItem);
                                isFocus && $('[_dn_cdn_host]').eq(index).focus();
                                break;
                            case 20008:
                                newItem.error_tip = errorTips.HOST_NEED_VERIFY;
                                hostArray.splice(index, 1);
                                hostArray.splice(index, 0, newItem);
                                isFocus && $('[_dn_cdn_host]').eq(index).focus();
                                break;
                            case 20009:
                                newItem.error_tip = errorTips.HOST_BLACKLIST;
                                hostArray.splice(index, 1);
                                hostArray.splice(index, 0, newItem);
                                isFocus && $('[_dn_cdn_host]').eq(index).focus();
                                break;
                            case 20010:
                                newItem.error_tip = errorTips.HOST_ILLEGAL;
                                hostArray.splice(index, 1);
                                hostArray.splice(index, 0, newItem);
                                isFocus && $('[_dn_cdn_host]').eq(index).focus();
                                break;
                            case 9138:
                                var domain = rs.data.domain
                                newItem.verify_url = 'http://' + domain + '/qcloud_cdn.html';
                                newItem.verify_domain = domain;
                                newItem.verify_tip = verifyTips.HOST,
                                newItem.verify_show = true;
                                newItem.host_error_tip_show = false;
                                hostArray.splice(index, 1);
                                hostArray.splice(index, 0, newItem);
                                isFocus && $('[_dn_cdn_host]').eq(index).focus();
                                break;
                            default:
                                newItem.error_tip = rs.msg;
                                hostArray.splice(index, 1);
                                hostArray.splice(index, 0, newItem);
                                isFocus && $('[_dn_cdn_host]').eq(index).focus();
                        }
                        isFocus && $('[_dn_cdn_host]').eq(index).focus();
                    });

                    // 与源站域名对比校验
                    if (that.$data.origin_is_domain) {
                        var origin = $.trim(that.$data.origin.split(/\n/)[0]).split(':')[0];
                        if (host == origin) {
                            that.$set({
                                origin_format_error: true,
                                origin_ip_tip: originTips.ORIGIN_ERROR,
                            });
                        } else {
                            that.$set({
                                origin_format_error: false,
                                origin_ip_tip: originTips.DEFAULT,
                            });
                        }
                    }
                }, 1000);
            },
            add: function() {
                var hostArray = this.$data.hostArray;
                hostArray.push({
                    host: "",
                    host_error: false,
                    host_error_tip_show: false,
                    loading: false,
                    success: false,
                    error_tip: errorTips.HOST_EMPTY,
                    verify_show: false,
                    verify_icon: true,
                    verify_tip: verifyTips.HOST,
                    verify_url:"",
                });
                if (hostArray.length > 9) {
                    this.$set({
                        add_show: false
                    });
                }
                $('[_dn_cdn_host]').eq(hostArray.length - 1).focus();
            },
            deleteHost: function(index) {
                var hostArray = this.$data.hostArray;
                hostArray.splice(index, 1);
                if (hostArray.length < 10) {
                    this.$set({
                        add_show: true
                    });
                }
            },
            verifyIconClick: function(index) {
                var hostArray = this.$data.hostArray;
                hostArray[index].verify_icon = !hostArray[index].verify_icon;
                Component.$set({
                    hostArray: []
                });
                Component.$set({
                    hostArray: hostArray
                });
            },
            verify: function(index) {
                var hostArray = this.$data.hostArray;
                hostArray[index].loading = true;
                Component.$set({
                    hostArray: []
                });
                Component.$set({
                    hostArray: hostArray
                });
                if (hostArray[index].host.indexOf("*") === 0) {
                    checkWildcardHost({host: hostArray[index].host}).done(function(rs) {
                        hostArray[index].loading = false;
                        hostArray[index].success = true;
                        hostArray[index].verify_result = true;
                        hostArray[index].verify_show = false;
                        hostArray[index].host_error = false;
                        Component.$set({
                            hostArray: []
                        });
                        Component.$set({
                            hostArray: hostArray
                        });
                    }).fail(function(rs) {
                        hostArray[index].loading = false;
                        hostArray[index].host_error = true;
                        hostArray[index].verify_result = false;
                        Component.$set({
                            hostArray: []
                        });
                        Component.$set({
                            hostArray: hostArray
                        });
                    })
                }
                else {
                    checkReclaimHost({host: hostArray[index].host}).done(function(rs) {
                        hostArray[index].verify_result = true;
                        dialog.create($('[_dn_cdn_tmpl="dialog_delete_domain"]').html(), '550', '', {
                            title: '域名管理权限验证',
                            preventResubmit: true,
                            "class": "dialog_layer_v2 shutdown-cdn",
                            button: {
                                '确定': function() {
                                    dialog.hide();
                                    reclaimHost({host:hostArray[index].host}).done(function(rs) {
                                        hostArray[index].success = true;
                                        hostArray[index].loading = false;
                                        hostArray[index].verify_show = false;
                                        hostArray[index].host_error = false;
                                        Component.$set({
                                            hostArray: []
                                        });
                                        Component.$set({
                                            hostArray: hostArray
                                        });
                                    }).fail(function(rs) {

                                    });
                                }
                            },
                        });
                    }).fail(function(rs) {
                        if (rs.code == 9139) {
                            dialog.create($('[_dn_cdn_tmpl="dialog_qiniu"]').html(), '550', '', {
                                title: '域名管理权限验证',
                                preventResubmit: true,
                                "class": "dialog_layer_v2 shutdown-cdn",
                                button: {
                                    '知道了': function() {
                                        dialog.hide();
                                    }
                                },
                                defaultCancelBtn:false
                            });
                            hostArray[index].verify_result = true;
                        }
                        else if (rs.code == 9143){
                            dialog.create($('[_dn_cdn_tmpl="dialog_work_order"]').html(), '550', '', {
                                title: '域名管理权限验证',
                                preventResubmit: true,
                                "class": "dialog_layer_v2 shutdown-cdn",
                                button: {
                                    '提交工单': function() {
                                        window.open("https://"+CDN.domain+"/ticket");
                                        dialog.hide();
                                    }
                                }
                            });
                            hostArray[index].verify_result = true;
                        }
                        else if (rs.code == 9144){
                            hostArray[index].verify_result_tip = verifyResultTips.FAIL_BANNED;
                            hostArray[index].verify_result = false;
                        }
                        else {
                            hostArray[index].verify_result_tip = verifyResultTips.FAIL_FILE_NOT_UPLOAD;
                            hostArray[index].verify_result = false;
                        }
                        hostArray[index].host_error = true;
                        hostArray[index].loading = false;
                        Component.$set({
                            hostArray: []
                        });
                        Component.$set({
                            hostArray: hostArray
                        });
                    });
                }

            },
            cnameOriginInput: function () {
                var originArray = this.$data.origin.split(/\n/);
                var domainsCount = 0;
                var ipsCount = 0;   // 包括 ipv4 + ipv6
                var ipv6sCount = 0;
                var weightCount = 0;
                var originsStr = '';
                if (checkHostTimeoutOrigin) {
                    clearTimeout(checkHostTimeoutOrigin);
                    checkHostTimeoutOrigin = null;
                }

                for (var i = 0; i < originArray.length; i++) {
                    var origin = $.trim(originArray[i]);
                    if (origin === '') continue;

                    var isWeight = false, weight;
                    // 权重回源
                    // ip(:port)?:weight
                    var weightMatch = origin.match(/^(.*)::(\d+)$/);
                    if (weightMatch) {
                        if (cdnutil.testIp(weightMatch[1]) || cdnutil.testIpv6(weightMatch[1])) {
                            isWeight = true;
                            origin = weightMatch[1];
                            weight = +weightMatch[2];
                        }
                    } else {
                        // ip:port:weight
                        weightMatch = origin.match(/^(.*:\d+):(\d+)$/);
                        if (weightMatch) {
                            if (cdnutil.testIpAndPort(weightMatch[1]) || cdnutil.testIpv6AndPort(weightMatch[1])) {
                                isWeight = true;
                                origin = weightMatch[1];
                                weight = +weightMatch[2];
                            }
                        }
                    }

                    // 非IPV4 或 为内网 IPV4
                    var isV4 = cdnutil.testIpAndPort(origin);
                    var isV6 = cdnutil.testIpv6AndPort(origin);
                    var isDomain = cdnutil.testDomainAndPort(origin);

                    // 非ip也非域名
                    if (!isV4 && !isV6 && !isDomain) return this.$set({
                        origin_format_error: true,
                        origin_ip_tip: originTips.FORMAT_ERROR,
                    });

                    // 内网ip
                    if (isV4 && !cdnutil.checkIntranet(origin)) {
                        return this.$set({
                            origin_format_error: true,
                            origin_ip_tip: originTips.FORMAT_ERROR,
                        });
                    };

                    // IPV6 域名 不支持配置权重
                    if ((isDomain || isV6) && isWeight) {
                        return this.$set({
                            origin_format_error: true,
                            origin_ip_tip: isDomain ? originTips.WEIGHT_DOMAIN : originTips.WEIGHT_IPV6,
                        });
                    }

                    if (isDomain) domainsCount++;
                    else ipsCount++;

                    if (isWeight) weightCount++;
                    if (isWeight && weight > 1000) return this.$set({
                        origin_format_error: true,
                        origin_ip_tip: originTips.WEIGHT_OVERFLOW,
                    });

                    // 多于 1 个域名 或 域名ip混输
                    if (domainsCount > 1 || (domainsCount === 1 && ipsCount > 0)) return this.$set({
                        origin_format_error: true,
                        origin_ip_tip: this.$data.ipv6 ? originTips.DEFAULT_V6 : originTips.DEFAULT,
                    });

                    // ipv4 输入了 ipv6
                    if (!this.$data.ipv6 && isV6) return this.$set({
                        origin_format_error: true,
                        origin_ip_tip: this.$data.support_ipv6 ? originTips.V4_BUT_V6 : originTips.NOT_SUPPORT_V6,
                    });

                    // ipv6 输入了域名 现支持输入域名
                    // if (this.$data.ipv6 && isDomain) return this.$set({
                    //     origin_format_error: true,
                    //     origin_ip_tip: originTips.V6_BUT_DOMAIN,
                    // });

                    if (isV6) ipv6sCount++;
                    if (ipv6sCount > 1) return this.$set({
                        origin_format_error: true,
                        origin_ip_tip: originTips.IPV6_OVERFLOW,
                    });

                    // 超过 32 个ip
                    if (ipsCount > 32) return this.$set({
                        origin_format_error: true,
                        origin_ip_tip: originTips.IP_OVERFLOW,
                    });

                    // 部分 IP 配置了权重
                    if (weightCount > 0 && weightCount !== ipsCount) return this.$set({
                        origin_format_error: true,
                        origin_ip_tip: originTips.WEIGHT_SOME_IP,
                    });

                    // 和域名相同
                    if (isDomain) {
                        this.$set({ origin_is_domain: true });
                        for (var i = 0; i < this.$data.hostArray.length; i++) {
                            if (this.$data.hostArray[i].host == origin.split(":")[0]) {
                                return this.$set({
                                    origin_format_error: true,
                                    origin_ip_tip: originTips.ORIGIN_ERROR,
                                });
                            }
                        }
                    } else {
                        this.$set({ origin_is_domain: false });
                    }

                    if (isV6) {
                        var match = origin.match(/^\[(.*?)\]:(\d+)$/);
                        if (match) originsStr += match[1];
                        else originsStr += origin;
                    } else {
                        originsStr += origin.split(':')[0];
                    }
                    originsStr += ';';
                }

                // 单IP权重
                if (ipsCount === 1 && weightCount === ipsCount) return this.$set({
                    origin_format_error: true,
                    origin_ip_tip: originTips.WEIGHT_SINGLE,
                });

                originsStr = originsStr.substring(0, originsStr.length - 1);
                this.$set({
                    origin_format_error: false,
                    origin_ip_tip: this.$data.ipv6 ? originTips.DEFAULT_V6 : originTips.DEFAULT,
                });


                var that = this;
                checkHostTimeoutOrigin = setTimeout(function() {
                    checkHost({host: originsStr, type: "origin"}).done(function(rs) {
                        if (rs.code == 0 && checkHostTimeoutOrigin) {
                            that.$set({
                                origin_error: "",
                                origin_format_error: false,
                                origin_ip_tip: that.$data.ipv6 ? originTips.DEFAULT_V6 : originTips.DEFAULT,
                            });
                        }
                    }).fail(function(rs){
                        if (!checkHostTimeoutOrigin) return;
                        if (rs.code != 0) {
                            var str = rs.data.length ? rs.data[0].host : '';
                            for (var i = 1; i < rs.data.length; i++) {
                                str += "," + rs.data[i].host;
                            }
                            that.$set({
                                origin_error: str,
                                origin_format_error: true
                            });
                        }
                        else {
                            that.$set({
                                origin_error: "",
                                origin_format_error: false
                            });
                        }
                    });
                }, 1000);

            },
            cosOriginSelect: function(origin) {
                var self = this;
                this.$set({
                    cos_origin: origin,
                    cos_origin_value: origin.Name + '（' + origin.Location + '）',
                    select_panel_show: false,
                    origin_cos_error: false,
                    cos_has_bucket_auth: undefined,
                });
                getBucketPolicy(origin.Name, origin.Location)
                    .done(function (hasAuth) {
                        self.$set({
                            cos_has_bucket_auth: hasAuth === 'AccessDenied' ? false : hasAuth,
                            cos_has_interface_right: hasAuth !== 'AccessDenied'
                        });
                    });
            },
            cosOriginKeyup: function() {
                this.$set({
                    select_panel_show: true
                });
            },
            getCosOriginLink: function () {
                return this.$data.cos_origin.Name + (this.$data.cos_bucket_type === 'website' ? '.cos-website.' : '.cos.') + this.$data.cos_origin.Location + '.myqcloud.com';
            },
            getCosBucketPolicyLink: function (origin) {
                var pieces = origin.split('.');
                return 'https://console.cloud.tencent.com/cos5/bucket/setting?type=aclconfig&bucketName=' + pieces[0] + '&region=' + pieces[2];
            },
            tryAuthorizeBucket: function () {
                var bucket = this.$data.cos_origin.Name;
                var region = this.$data.cos_origin.Location;
                var self = this;
                // 无权限告知用户配置权限
                if (!this.$data.cos_has_interface_right) {
                    var noauthTmpl = tmpl.parse($('[_dn_cdn_tmpl="dialog_cos_bucket_noauth"]').html(), { bucket: bucket });
                    dialog.create(noauthTmpl, '', '', {
                        preventResubmit: true,
                        struct: "rich",
                        "class": "tc-15-rich-dialog",
                        defaultCancelBtn:false,
                        button: {
                            '确定': function() {
                                dialog.hide();
                            },
                        },
                    });
                } else {
                    var putpolicyTmpl = tmpl.parse($('[_dn_cdn_tmpl="dialog_cos_bucket_putpolicy"]').html(), {  });
                    dialog.create(putpolicyTmpl, '', '', {
                        title: '确定添加服务授权？',
                        struct: "rich",
                        "class": "tc-15-rich-dialog",
                        onload: function ($dialog) {
                            $dialog.find('.tc-15-rich-dialog-ft .tc-15-btn').eq(0).addClass('disabled');
                            $dialog.find('[name=bucket-path]').on('change', function (e) {
                                var wrap = $dialog.find('[name=bucket-path-text]').parent();
                                if (e.target.value === 'path') {
                                    wrap.find('span').text(bucket + '/');
                                    wrap.show();
                                } else {
                                    wrap.hide();
                                }
                            });

                            $dialog.find('[name=bucket-agree]').on('change', function (e) {
                                var confirmBtn = $dialog.find('.tc-15-rich-dialog-ft .tc-15-btn').eq(0);
                                e.target.checked ? confirmBtn.removeClass('disabled') : confirmBtn.addClass('disabled');
                            });
                        },
                        button: {
                            '确定': function($btn, $dialog) {
                                var pathWho = $dialog.find('[name=bucket-path]:checked').val();
                                var path = pathWho == 'whole' ? '' : $dialog.find('[name=bucket-path-text]').val();

                                putBucketPolicy(bucket, region, path)
                                    .done(function (hasAuth) {
                                        self.$set({
                                            cos_has_bucket_auth: hasAuth === 'AccessDenied' ? false : hasAuth,
                                            cos_has_interface_right: hasAuth !== 'AccessDenied',
                                        });
                                        dialog.hide();
                                    })
                                    .fail(function (rs) {
                                        if (rs.code == 'AccessDenied') {
                                            dialog.hide();
                                            var noauthTmpl = tmpl.parse($('[_dn_cdn_tmpl="dialog_cos_bucket_noauth"]').html(), { bucket: bucket });
                                            var $noauthDialog = dialog.create(noauthTmpl, '', '', {
                                                preventResubmit: true,
                                                struct: "rich",
                                                "class": "tc-15-rich-dialog",
                                                defaultCancelBtn:false,
                                                button: {
                                                    '确定': function() {
                                                        $noauthDialog.hide();
                                                    },
                                                },
                                            });
                                        }
                                });
                            },
                        },
                    });
                }
            },
            panelClick: function() {
                if (!this.$data.select_panel_show == true) {
                    this.$set({
                        select_panel_show:!this.$data.select_panel_show,
                        cos_origin_search_list: this.$data.cos_origin_list
                    });
                }
                else {
                    this.$set({
                        select_panel_show:!this.$data.select_panel_show,
                    });
                }
            },
            addCache: function() {
                var cache_custom = this.cache_custom;
                if (this.cache_mode == 'simple') {
                    cache_custom.push({
                        time_error: false,
                        content_error: false,
                        type: "1",
                        content: "",
                        time: "",
                        unit: "d"
                    });
                }
                else if (this.cache_mode == 'advanced'){
                    cache_custom.push({
                        time_error: false,
                        content_error: false,
                        type: "4",
                        content: "无max-age",
                        time: "",
                        unit: "d"
                    });
                }
                else {
                    cache_custom.push({
                        time_error: false,
                        content_error: false,
                        type: "0",
                        content: "all",
                        time: "",
                        unit: "d"
                    });
                }
                if (cache_custom.length > 8) {
                    this.$set({
                        add_cache_show: false
                    })
                }
                $("[_dn_cdn_custom_content]").eq(cache_custom.length - 1).prop("placeholder", ".jpg;.png;.css");
            },
            deleteCache: function(index) {
                var cache_custom = this.cache_custom;
                cache_custom.splice(index, 1);
                if (cache_custom.length < 9) {
                    this.$set({
                        add_cache_show: true
                    })
                }
            },
            defaultCacheTimeKeyup: function() {
                if (defaultCheckTimeTimeout) {
                    clearTimeout(defaultCheckTimeTimeout);
                }
                var that = this;
                defaultCheckTimeTimeout = setTimeout(function() {
                    var cache_default = that.cache_default;
                    var timeValue = $.trim(cache_default.time);

                    if (timeValue == "" || !(timeValue >= 0)) {
                        cache_default.time = timeValue;
                        cache_default.time_error = true;
                    }
                    else {
                        cache_default.time = timeValue;
                        cache_default.time_error = false;
                    }
                    that.$set({
                        cache_default: cache_default
                    });
                    $("[_dn_cdn_default_time]").focus();
                }, 300);
            },
            cacheConteneKeyup: function(index, needFocus) {
                if(checkContentTimeout[index]) {
                    clearTimeout(checkContentTimeout[index]);
                }
                var that = this;
                needFocus = needFocus == undefined ? true : needFocus;
                checkContentTimeout[index] = setTimeout(function() {
                    var cache_custom = that.cache_custom;
                    var newItem = $.extend({}, cache_custom[index]);
                    var type = cache_custom[index].type;
                    var content = $.trim(cache_custom[index].content);
                    newItem.content = content;
                    var reg;
                    if(type == 1) {
                        reg = /^((\.[a-zA-Z0-9]{1,});)*\.[a-zA-Z0-9]{1,}(;)?$/;
                    }
                    else if (type == 2) {
                        reg = /^(\/[^;|:\/<>*"\\]+;?)*$/;
                    }
                    else {
                        reg = /^\/[^;|:<>"\\]*(;\/[^;|:<>"\\]*)*$/;
                    }
                    if(!reg.test(content)) {
                        newItem.content_error = true;
                    }
                    else {
                        newItem.content_error = false;
                    }
                    that.cache_custom.splice(index, 1);
                    that.cache_custom.splice(index, 0, newItem);
                    // 输入触发的校验不能失焦，但是别的场景下的校验不能对焦
                    if (needFocus) {
                        $("[_dn_cdn_custom_content]").eq(index).focus();
                    }
                }, 300);
            },
            cacheTimeKeyup: function(index, needFocus) {
                if (checkTimeTimeout[index]) {
                    clearTimeout(checkTimeTimeout[index]);
                }
                var that = this;
                needFocus = needFocus == undefined ? true : needFocus;
                checkTimeTimeout[index] = setTimeout(function() {
                    var cache_custom = that.cache_custom;
                    var newItem = $.extend({}, cache_custom[index]);
                    var timeValue = $.trim(newItem.time);
                    newItem.time = timeValue;
                    if (timeValue === "" || !(timeValue >= 0)) {
                        newItem.time_error = true;
                    }
                    else {
                        newItem.time_error = false;
                    }
                    that.cache_custom.splice(index, 1);
                    that.cache_custom.splice(index, 0, newItem);

                    if (timeValue == 0 && newItem.type == 4) {
                        $('[_cdn_cache_max_age_tip]').show();
                    }
                    else {
                        var tipHide = true;
                        for (var i = 0; i < cache_custom.length; i++) {
                            if (cache_custom[i].type == 4 && cache_custom[i].time == 0) {
                                tipHide = false;
                            }
                        }
                        if (tipHide) {
                            $('[_cdn_cache_max_age_tip]').hide();
                        }
                    }
                    // 输入触发的校验不能失焦，但是别的场景下的校验不能对焦
                    if (needFocus) {
                        $("[_dn_cdn_custom_time]").eq(index).focus();
                    }
                }, 300);
            },
            cacheTypeChange: function(index) {
                var content = this.cache_custom[index].content;
                var type = this.cache_custom[index].type;
                var newItem = $.extend({}, this.cache_custom[index]);
                if (type == 1) {
                    $("[_dn_cdn_custom_content]").eq(index).prop("placeholder", ".jpg;.png;.css").val("").prop("disabled", false);
                }
                else if (type == 2) {
                    $("[_dn_cdn_custom_content]").eq(index).prop("placeholder", "/1234;/test;/a/b").val("").prop("disabled", false);
                }
                else if (type == 3) {
                    $("[_dn_cdn_custom_content]").eq(index).prop("placeholder", "/index.html;/test/*.jpg;/").val("").prop("disabled", false);
                }
                else if (type == 5) {
                    newItem.type = 5;
                    newItem.content_error = false;
                    newItem.content = "/"
                    this.cache_custom.splice(index, 1);
                    this.cache_custom.splice(index, 0, newItem);
                    $("[_dn_cdn_custom_content]").eq(index).prop("disabled", true);
                }
                else if (type == 4) {
                    newItem.type = 4;
                    newItem.content_error = false;
                    newItem.content = "无max-age"
                    this.cache_custom.splice(index, 1);
                    this.cache_custom.splice(index, 0, newItem);
                }
                else if (type == 0) {
                    newItem.type = 0;
                    newItem.content_error = false;
                    newItem.content = "all"
                    this.cache_custom.splice(index, 1);
                    this.cache_custom.splice(index, 0, newItem);
                }
                else {
                    newItem.type = 0;
                    newItem.content_error = false;
                    newItem.content = ""
                    this.cache_custom.splice(index, 1);
                    this.cache_custom.splice(index, 0, newItem);
                }
            },
            submit: function() {
                var data = {};
                var ipArray = [];
                var checkError = false;
                var hostArray = this.hostArray;
                var cache_default = this.cache_default;
                var cache_custom = this.cache_custom;
                var hostReg = /.*(\.aliyuncs.com)|(\.s3\.amazonaws\.com)$/;
                hostArray.forEach(function(item, index) {
                    if (item.host_error == true || item.host == "") {
                        checkError = true;
                        hostArray[index].host_error = true;
                    }
                    else {
                        hostArray[index].host_error = false;
                    }
                });
                Component.$set({
                    hostArray: []
                });
                Component.$set({
                    hostArray: hostArray
                });

                if (checkError) {
                    return;
                }
                else {
                    data.host = $.map(hostArray, function(item) {
                        return item.host;
                    }).join(";");
                }
                if (cache_default.time_error == true || cache_default.content_error == true || cache_default.time === "" || cache_default.content == "") {
                    checkError = true;
                }
                cache_custom.forEach(function(item, index) {
                    if (item.time_error == true || item.content_error == true ||  item.time === "" || item.content === "") {
                        checkError = true;
                    }
                });
                if (checkError) {
                    return;
                }
                else {
                    cache_default = [[]];
                    cache_default[0].push(this.cache_default.type);
                    cache_default[0].push(this.cache_default.content);
                    cache_default[0].push(this.cache_default.time*this.timeMap[this.cache_default.unit]);
                    cache_default[0].push(this.cache_default.unit);
                    cache_custom = [];
                    this.cache_custom.forEach(function(_item, _index){
                        var arr = [];
                        arr.push(_item.type);
                        arr.push(_item.content);
                        arr.push(_item.time*Component.timeMap[_item.unit]);
                        arr.push(_item.unit);
                        cache_custom.push(arr);
                    });
                    if (this.cache_mode == "simple") {
                        data.cache = JSON.stringify(cache_default.concat(cache_custom));
                    }
                    else {
                        data.cache_mode = "advanced";
                        data.host_config = JSON.stringify({
                            advanced_cache: {
                                config_value: $.map(cache_custom, function(item, index) {
                                    return {
                                        type: item[0],
                                        rule: item[1],
                                        time: item[2],
                                        unit: item[3]
                                    }
                                })
                            }
                        });
                    }
                }

                if(this.$data.host_type === 'cname') {
                    data.host_type = "cname";
                    var origins = this.$data.origin.split(/\n/);
                    if (this.$data.origin_format_error || this.$data.origin_error) return;
                    data.origin = origins.join(';');
                }
                else {
                    data.host_type = this.$data.host_type;
                    if (data.host_type == "cos") {
                        if (!this.$data.cos_origin.Name) {
                            return this.$set({ origin_cos_error: true });
                        } else if (this.$data.cos_bucket_type === 'website' && !this.$data.cos_bucket_website_open) {
                            return;
                        } else {
                            this.$set({ origin_cos_error: false });
                            data.origin = this.getCosOriginLink();
                        }
                    }
                }
                data.furl_cache = this.$data.furl_cache ? "off" : "on";
                data.service_type = this.$data.service_type;
                data.project_id = this.$data.project_id;

                if (this.$data.fwd_host_type == "default") {
                    if (this.$data.host_type === 'cname' && this.$data.origin_is_domain) {
                        data.fwd_host = data.origin;
                    } else if (this.$data.host_type == "cos"){
                        data.fwd_host_type = "custom";
                        data.fwd_host = data.origin;
                    }
                } else {
                    data.fwd_host_type = "custom";
                    data.fwd_host = this.$data.fwd_host;
                }

                if (this.$data.share_cname) {
                    data.cname_host = this.$data.hostArray[0].host;
                }

                if (this.$data.edge_computing_open) {
                    data.enable_edge_computing = this.$data.edge_computing ? 'on' : 'off';
                }

                if (this.$data.cos_has_hy_auth) {
                    data.host_config = { cos_origin_authorization: { config_value: { authorization_switch: 'on' } } };
                }

                if (this.$data.ipv6 && this.$data.host_type === 'cname') {
                    data.ipv6 = 'on';
                }

                if (typeof this.$data.overseaProjectId !== 'undefined' && +this.$data.project_id !== +this.$data.overseaProjectId) {
                    var that = this;
                    var projectName = _.find(this.$data.projectList, function (project) { return +project.id === +that.$data.project_id });
                    projectName = projectName && projectName.name;
                    var overseaProjectName = _.find(this.$data.projectList, function (project) { return +project.id === +that.$data.overseaProjectId });
                    overseaProjectName = overseaProjectName && overseaProjectName.name;
                    dialog.create(
                        tmpl.parse(
                            $('[_dn_cdn_tmpl="dialog_repeat_project"]').html(),
                            { host: data.host, project: projectName, overseaProject: overseaProjectName }
                        ),
                        '500', '',
                        {
                            title: '项目冲突',
                            preventResubmit: true,
                            struct: "rich",
                            class: "tc-15-rich-dialog",
                            button: {
                                '确认': function () {
                                    dialog.hide();
                                    submit();
                                },
                            },
                        }
                    );
                } else {
                    submit();
                }

                function submit() {
                    addHost(data).done(function(rs) {
                        var tmplStr = tmpl.parse($('[_dn_cdn_tmpl="success_dialog"]').html(), {host: data.host});
                        dialog.create(tmplStr, '620', '', {
                            title: '',
                            preventResubmit: true,
                            struct: "rich",
                            "class": "tc-15-rich-dialog",
                            isMaskClickHide: false,
                            closeIcon: false,
                            defaultCancelBtn:false,
                            buttonHighlight:[1,0],
                            button: {
                                '进入域名管理': function() {
                                    dialog.hide();
                                    router.navigate("/cdn/access");
                                },
                                '更多配置': function() {
                                    dialog.hide();
                                    router.navigate("/cdn/access/manage/" + rs.data.id);
                                }
                            },
                        });
                    }).fail(function(rs){
                    });
                }
            }
        });

        getUserCosStatus().done(function (is_v4) {
            Component.$set({ cos_isv4: is_v4 });
            if (!is_v4) {
                getBuckList().done(function(buckets) {
                    Component.$set({
                        cos_origin_list: buckets,
                        cos_origin_search_list: buckets
                    });
                });
            }
        });

        getProjectList().done(function(rs) {
            if (rs.data.projects.length > 0) {
                   Component.$set({
                    projectList: rs.data.projects,
                    project_id: rs.data.projects[0].id
                });
            }
        }).fail(function(rs){});

        getPermission().done(function(rs) {
            if (rs.data && (rs.data.permission === "MANAGE_HUMAN_RESOURCE" || rs.data.permission === "MANAGE_CLOUD_RESOURCE"))
            {
                Component.$set({permission: true});
            }
        }).fail(function(rs) {});

        getWhiteList().done(function(rs) {
            if (rs.data.indexOf("ftp") > -1) {
                Component.$set({ftp_permisstion: true});
            }
            if (rs.data.indexOf("oversea_customer") > -1) {
                Component.$set({
                    cache_mode: "advanced",
                    cache_custom:[],
                });
            }
            if (rs.data.indexOf("edge_computing") > -1) {
                Component.$set({
                    edge_computing_open: true
                })
            }
            if (rs.data.indexOf("lua_rule_engine") == -1) {
                Component.$set({
                    lua_rule_engine: false
                })
            }
            if (rs.data.indexOf("vip-platform") > -1 && rs.data.indexOf("ip_protocol_v6") > -1) {
                Component.$set({
                    support_ipv6: true,
                });
            }
        }).fail(function(rs) {});

        $('[_dn_cdn_host]').focus();
    };

    /*
      以下是cgi接口调用，包装成defer
    **/
   var getUserCosStatus = function() {
        var defer = $.Deferred();

        var url = location.protocol + '//cos5.' + (location.hostname.indexOf('cloud.tencent') > -1 ? 'cloud.tencent' : 'qcloud') + '.com/auth/userStatus';
        $.ajax({
            url: url,
            data: {
                mc_gtk: yaCdnUtil.getACSRFToken(),
            },
            xhrFields: {
                withCredentials: true
            },
            dataType: 'json',
            success: function (rs) {
                if (rs.code != 0) return tips.error(rs.message || defaultErrorMsg);

                defer.resolve(rs.data ? +rs.data.version === 4 : undefined);
            },
            error: function (rs) {
                tips.error(rs.msg || rs.message || defaultErrorMsg);
            }
        });

        return defer.promise();
    };
    var getBucketWebsiteStatus = function(bucket, region) {
        var defer = $.Deferred();
        var url = location.protocol + '//cos5.' + (location.hostname.indexOf('cloud.tencent') > -1 ? 'cloud.tencent' : 'qcloud') + '.com/bucket/website';
        $.ajax({
            url: url,
            data: {
               mc_gtk: yaCdnUtil.getACSRFToken(),
               Bucket: bucket,
               Region: region,
               _: new Date().getTime(),
            },
            xhrFields: {
                withCredentials: true
            },
            dataType: 'json',
            success: function (rs) {
                if (rs.code != 0) {
                    tips.error(rs.message || defaultErrorMsg);
                    return defer.resolve(false);
                }
                defer.resolve(!!rs.data.RoutingRules);
            },
            error: function (rs) {
                tips.error(rs.msg || rs.message || defaultErrorMsg);
                defer.resolve(false);
            },
        });
        return defer.promise();
    };

    var getBuckList = function() {
        var defer = $.Deferred();

        var url = location.protocol + '//cos5.' + (location.hostname.indexOf('cloud.tencent') > -1 ? 'cloud.tencent' : 'qcloud') + '.com/bucket/list';
        $.ajax({
            url: url,
            data: {
                mc_gtk: yaCdnUtil.getACSRFToken(),
            },
            xhrFields: {
                withCredentials: true
            },
            dataType: 'json',
            success: function (rs) {
                if (rs.code != 0) return defer.reject(rs.message || defaultErrorMsg);

                _.each(rs.data.Buckets, function (bucket) {
                    bucket.origin = bucket.Name + '（' + bucket.Location + '）';
                });

                defer.resolve(rs.data.Buckets);
            },
            error: function (rs) {
                defer.reject(rs);
                tips.error(rs.msg || rs.message || defaultErrorMsg);
            }
        });

        return defer.promise();
    };

    var getBucketPolicy = function (bucket, region) {
        var defer = $.Deferred();

        var url = location.protocol + '//cos5.' + (location.hostname.indexOf('cloud.tencent') > -1 ? 'cloud.tencent' : 'qcloud') + '.com/bucket/getBucketCdnAuth';

        $.ajax({
            url: url,
            data: {
                mc_gtk: yaCdnUtil.getACSRFToken(),
                Bucket: bucket,
                Region: region
            },
            xhrFields: {
                withCredentials: true
            },
            dataType: 'json',
            success: function (rs) {
                if (rs.code != 0 && rs.code != 'AccessDenied') {
                    tips.error(rs.message || defaultErrorMsg);
                    return defer.reject();
                }

                defer.resolve(rs.code == 0 ? rs.data.hasAuth : 'AccessDenied');
            },
            error: function (rs) {
                defer.reject(rs);
                tips.error(rs.msg || rs.message || defaultErrorMsg);
            }
        });

        return defer.promise();
    };

    var putBucketPolicy = function (bucket, region, path) {
        var defer = $.Deferred();

        var url = location.protocol + '//cos5.' + (location.hostname.indexOf('cloud.tencent') > -1 ? 'cloud.tencent' : 'qcloud') + '.com/bucket/putBucketCdnAuth?mc_gtk=' + yaCdnUtil.getACSRFToken();

        $.ajax({
            url: url,
            type: 'POST',
            data: {
                Bucket: bucket,
                Region: region,
                uin: CDN.white_list.uin,
                path: path || '',
            },
            xhrFields: {
                withCredentials: true
            },
            dataType: 'json',
            success: function (rs) {
                if (rs.code != 0) {
                    tips.error(rs.code == 'AccessDenied' ? ('您没有存储桶 ' + bucket + ' CDN 服务授权权限，请联系开发商为您分配权限后操作。') : (rs.message || defaultErrorMsg));
                    return defer.reject();
                }

                defer.resolve(rs.data.hasAuth);
            },
            error: function (rs) {
                defer.reject(rs);
                tips.error(rs.msg || rs.message || defaultErrorMsg);
            }
        });

        return defer.promise();
    };

    var checkReclaimHost = function(data) {
        var defer = $.Deferred();
        dao.check_reclaim_host({
            showLoadingIcon: false,
            data: data,
            success: {
                0: function (rs) {
                    defer.resolve(rs);
                },
                default: function (rs) {
                    defer.reject(rs);
                }
            }
        });
        return defer.promise();
    };

    var reclaimHost = function(data) {
        var defer = $.Deferred();
        dao.reclaim_host({
            data: data,
            success: {
                0: function (rs) {
                    defer.resolve(rs);
                },
                default: function (rs) {
                    defer.reject(rs);
                    tips.error(rs.msg || defaultErrorMsg)
                }
            }
        });
        return defer.promise();
    };

    var checkWildcardHost = function(data) {
        var defer = $.Deferred();
        dao.check_wildcard_host({
            data: data,
            success: {
                0: function (rs) {
                    defer.resolve(rs);
                },
                default: function (rs) {
                    defer.reject(rs);
                    tips.error(rs.msg || defaultErrorMsg)
                }
            }
        });
        return defer.promise();
    };

    var checkHost = function(data) {
        var defer = $.Deferred();
        dao.check_host({
            showLoadingIcon: false,
            data: data,
            success: {
                0: function (rs) {
                    defer.resolve(rs);
                },
                default: function (rs) {
                    defer.reject(rs);
                }
            }
        });
        return defer.promise();
    };

    var getPermission = function() {
        var defer = $.Deferred();
        dao.get_permission({
            success: {
                0: function (rs) {
                    defer.resolve(rs);
                },
                default: function (rs) {
                    defer.reject(rs);
                    tips.error(rs.msg || defaultErrorMsg)
                }
            }
        });
        return defer.promise();
    };

    var getProjectList = function() {
        var defer = $.Deferred();
        dao.getProjectList({
            data: {field: "add"},
            success: {
                0: function (rs) {
                    defer.resolve(rs);
                },
                default: function (rs) {
                    defer.reject(rs);
                    tips.error(rs.msg || defaultErrorMsg)
                }
            }
        });
        return defer.promise();
    };

    var getWhiteList = function() {
        var defer = $.Deferred();
        dao.get_white_list({
            success: {
                0: function (rs) {
                    defer.resolve(rs);
                },
                default: function (rs) {
                    defer.reject(rs);
                    tips.error(rs.msg || defaultErrorMsg)
                }
            }
        });
        return defer.promise();
    };

    var addHost = function(data) {
        var defer = $.Deferred();
        dao.addHost({
            data: data,
            success: {
                0: function (rs) {
                    defer.resolve(rs);
                },
                default: function (rs) {
                    defer.reject(rs);
                    if (rs.code == 9194) {
                        tips.error("FTP源缓存过期时间需要大于300秒");
                    }
                    else {
                        tips.error(rs.msg || defaultErrorMsg);
                    }
                }
            }
        });
        return defer.promise();
    };

    return {
        container : guidestepTemplate,
        render : function() {
            init();
        },
        destroy: function() {

        }
    };

});
