/*
 * 接入管理页面
 */
define(function (require, exports, module) {
    var $ = require("cdn/$");
    var _ = require("cdn/lib/underscore");
    var tmpl = require("cdn/lib/tmpl");
    var dao = require('cdn/data/dao');
    var accessTemplate = require("../../templates/access.html.js");
    var router = require("cdn/router");
    var dialog = require('cdn/dialog');
    var evt = require('cdn/event');
    var contextMenu = require('cdn/contextmenu');
    var tips = require('cdn/tips');
    var eventproxy = require('cdn/lib/eventproxy');
    var util = require('cdn/util');
    var cdnUtil = require('cdn/lib/util');
    var mfa = require("widget/mfa/mfa");
    var api = require("models/api");

    var capiv3 = require("cdn/data/dao_cloud_api_v3").requestPromise;
    var qcvue = require('cdn/qcvue');
    var qcvueExtra = require('cdn/lib/qcvue_extra');
    var login = require('cdn/login')
    var tagApp;
    var tagErrorMessage = {
        30005: '用户资源标签已存在不能重复添加',
        30010: '单个用户最多1000个不同的key',
        30011: '单个资源标签键数不能超过50',
        30020: '单个标签键对应标签值达到上限数1000',
        30021: '标签键字符不合法，只能为数字、汉字、字母、空格、+-=._:/@',
        30022: '标签值字符不合法，只能为空或数字、汉字、字母、空格、+-=._:/@',
        30025: '标签键长度超过最大值',
        30026: '标签值长度超过最大值',
    };

    var _this = {
        page: 20,
        totalLimit: 3000,
        appid: $.cookie("cdn_appid"),
        data: {}
    };

    // 记录用户当前对表格操作的状态，与manageBackToAccess配合使用
    tableStatus = {
        page: 0,
        count: 0,
        statusResult: [],
        originResult: [],
        typeResult: [],
        projectResult: []
    };
    // 规避页码问题
    temp_page = 1;

    // 判断是否由域名配置页返回
    var manageBackToAccess = false;

    var refreshStatusInterval; // 接入管理页的状态会定时刷新
    var hostData = [],
        projectMap = {},
        projectList = [],
        projectNameMap = {};
    var b_domainTable;
    var b_dropdownList;

    var _defaultErrMsg = 'CDN系统正在繁忙中，请休息一下，稍后重试！';

    var ep;
    // 兼容境外控制台
    var oversea;
    // 海外入华客户
    var overseaCustomer;


    _this.ajaxPromise = function (requestName, data) {
        var defer = $.Deferred();
        data = data || {};

        dao[requestName]({
            data: data,
            success: {
                "0": function (rs) {
                    defer.resolve(rs);
                },
                "default": function (rs) {
                    if (rs.msg) {
                        tips.error(rs.msg);
                    } else {
                        tips.error(_defaultErrMsg);
                    }
                    defer.reject(rs);
                }
            }
        });
        return defer.promise();
    }

    _this.getFixedDataForHost = function (item) {
        var temp = {
            id: item.host_id,
            domain: item.host,

            // 用于测试开发
            status: item.status,
            ssl_status: item.ssl_status,
            ssl_type: item.ssl_type,
            type: item.service_type,

            cname: item.cname,
            project: projectMap[item.project_id],
            project_id: item.project_id,
            origin: item.host_type,
            origin_domain: item.origin || "",
            readonly: item.readonly,
            disabled: item.disabled,
            lock_msg: item.lock_msg || "",
            https: item.https || "",
            domestic_cdn_online: item.domestic_cdn_online || false,
            oversea_cdn_online: item.oversea_cdn_online || false,
        };
        return temp;
    }

    _this.main = function(data, fromTag) {
        // 获取域名列表
        var cgi = oversea ? "getHostListOv" : "getHostList";
        b_domainTable.$set('loading', true);

        if (data) {
            data.host = data.host && data.host.length ? data.host[0] : undefined;
            data.origin = data.origin &&  data.origin.length ? data.origin[0] : undefined;
        }
        _this.ajaxPromise(cgi, data).done(function(rs) {
            b_domainTable.$set('loading', false);
            _this.data = rs.data;
            projectMap = {};
            projectNameMap = {};
            projectList = rs.data.projects;
            _.forEach(rs.data.projects, function(item, index) {
                projectMap[item.id] = item.name
                projectNameMap[item.name] = item.id;
            });
            if (rs.data.hosts && rs.data.hosts.length >= 0) {
                hostData = [];
                _.forEach(rs.data.hosts, function(item, index) {
                    var temp = _this.getFixedDataForHost(item);
                    hostData.push(temp);
                });
                ep.emit("root:hostDataUpdate");
                if (manageBackToAccess) {
                    ep.emit("root:tableFilterUpdate", {page: tableStatus.page, count: tableStatus.count, fromTag: fromTag});
                    manageBackToAccess = false;
                }
                else {
                    ep.emit("root:tableFilterUpdate", { turnPage: 1, fromTag: fromTag });
                }
            }
        }).fail(function(rs) {
            console.log(rs);
        });
    };

    var initDialog = function() {

        var dialogCreate = function(options) {
            var tpl         = options.tpl,
                title       = options.title     || '',
                width       = options.width     || '480',
                className   = options.className || '',
                btnFn       = options.btnFn     || function() {},
                btnName     = options.btnName   || '',
                struct = options.struct || "";

            var button = {};
            button[btnName] = btnFn;

            return dialog.create(tpl, width, '', {
                title: title,
                preventResubmit: true,
                "class": className,
                button: button,
                struct: struct
            });
        };

        var generateCallbackWithData = function (idList, data) {
            _.forEach(idList, function (id, i) {
                var newHost = _.find(data, function (item, index) {
                    return item.host_id == id;
                });
                _.find(hostData, function (item, index) {
                    if (item.id == newHost.host_id) {
                        hostData[index] = _this.getFixedDataForHost(newHost);
                        return true;
                    }
                    return false;
                });
            });
            ep.emit("root:hostDataUpdate");
            ep.emit("root:tableFilterUpdate");
        }

        var deleteCallback = function (idList) {
            _.forEach(idList, function (id) {
                _.find(hostData, function (item, index) {
                    if (item.id == id) {
                        hostData.splice(index, 1);
                        return true;
                    }
                    return false;
                });
            });
            ep.emit("root:hostDataUpdate");
            ep.emit("root:tableFilterUpdate");
            if (hostData.length === 0) {
                _this.main();
            }
        }

        var _dialog = {
            startCDN: function(idList) {
                dialogCreate({
                    tpl: _this.tmpl.dialog_4,
                    width: '480',
                    title: '开启CDN',
                    className: "dialog_layer_v2 shutdown-cdn",
                    btnName: '确定开启',
                    btnFn: function() {
                        var cgi = oversea ? "setHostListOv" : "setHostList";
                        dialog.hide();
                        _this.ajaxPromise(cgi, {
                            host_id: idList.join(","),
                            enable_cdn: "yes",
                        }).then(function(res) {
                            generateCallbackWithData(idList, res.data);
                            tips.success("开启CDN服务成功！");
                        });
                    }
                });
            },
            startCDNsp: function(idList) {
                dialogCreate({
                    tpl: _this.tmpl.dialog_4S,
                    width: '550',
                    title: '开启CDN',
                    className: "dialog_layer_v2 shutdown-cdn",
                    btnName: '确定开启',
                    btnFn: function() {
                        var cgi = oversea ? "setHostListOv" : "setHostList";
                        dialog.hide();
                        _this.ajaxPromise(cgi, {
                            host_id: idList.join(","),
                            enable_cdn: "yes"
                        }).then(function(res) {
                            generateCallbackWithData(idList, res.data);
                            tips.success("开启CDN服务成功！");
                        });
                    }
                });
            },
            closeCDN: function(idList, domestic_cdn_online) {
                if (oversea || CDN.FormSender.serverUrl=="//cdninfo.qcloud.com") {
                    var dialogStr = tmpl.parse($('[data-cdn-tmpl="redirect_mainland_dialog"]').html(), {});
                    if (oversea && domestic_cdn_online) {
                       dialog.create(dialogStr, '580', '', {
                           title: '',
                           preventResubmit: true,
                           "class": "tc-15-rich-dialog",
                           button: {
                               '解析至中国大陆': function() {
                                   dialog.hide();
                                   _this.ajaxPromise("setHostListOv", {
                                       host_id: idList.join(","),
                                       enable_cdn: "no",
                                       offline_mode: 1
                                   }).then(function(res) {
                                       generateCallbackWithData(idList, res.data);
                                       tips.success("关闭CDN服务成功！");
                                   });
                               },
                               '关闭服务': function() {
                                   dialog.hide();
                                   _this.ajaxPromise("setHostListOv", {
                                       host_id: idList.join(","),
                                       enable_cdn: "no"
                                   }).then(function(res) {
                                       generateCallbackWithData(idList, res.data);
                                       tips.success("关闭CDN服务成功！");
                                   });
                               }
                           }
                       });
                    }
                    else {
                        dialogCreate({
                         tpl: _this.tmpl.dialog_5,
                         width: '480',
                         title: '关闭CDN',
                         className: "dialog_layer_v2 shutdown-cdn",
                         btnName: '确定关闭',
                         btnFn: function() {
                             var cgi = oversea ? "setHostListOv" : "setHostList";
                             dialog.hide();
                            _this.ajaxPromise(cgi, {
                                host_id: idList.join(","),
                                enable_cdn: "no"
                            }).then(function(res) {
                                generateCallbackWithData(idList, res.data);
                                tips.success("关闭CDN服务成功！");
                            });
                         }
                        });
                    }
                }
                else {
                    var doRequest = function(idList, cnameToOversea) {
                        mfa.verify({ api: "cdn:OfflineHost" }).then(function() {
                            var data = { hostIds: idList.join(',') };
                            if (cnameToOversea) data.cnameToOversea = 1;
                            // MFA 验证已通过，可以调用云 API
                            api.request({
                                regionId: 1,
                                serviceType: "cdn",
                                cmd: "OfflineHost",
                                data: data,
                            }, {
                                secure: true
                            }).then(function(rs) {
                                if (rs.code == "4106") {
                                    doRequest(idList);
                                    return;
                                }
                                _.forEach(idList, function (id, index) {
                                    _.forEach(hostData, function (item, _index) {
                                        if (item.id == id) {
                                            hostData[_index].status = 4;
                                        }
                                    });
                                });
                                ep.emit("root:hostDataUpdate");
                                ep.emit("root:tableFilterUpdate");
                                tips.success("关闭CDN服务成功！");
                            });
                        }, function() {});
                    }
                    if (domestic_cdn_online) {
                        var dialogStr = tmpl.parse($('[data-cdn-tmpl="redirect_oversea_dialog"]').html(), {});
                        dialog.create(dialogStr, '580', '', {
                            title: '',
                            preventResubmit: true,
                            // "class": "dialog_layer_v2 shutdown-cdn",
                            struct: "rich",
                            button: {
                                '解析至中国境外': function() {
                                    doRequest(idList, true);
                                    dialog.hide();
                                },
                                '关闭服务': function() {
                                    doRequest(idList);
                                    dialog.hide();
                                },
                            }
                        });
                    } else {
                        dialogCreate({
                            tpl: _this.tmpl.dialog_5,
                            width: '480',
                            title: '关闭CDN',
                            className: "dialog_layer_v2 shutdown-cdn",
                            btnName: '确定关闭',
                            btnFn: function() {
                                doRequest(idList);
                                dialog.hide();
                            }
                        });
                    }
                }
            },
            closeCDNsp: function(idList) {
                dialogCreate({
                    tpl: _this.tmpl.dialog_5S,
                    width: '550',
                    title: '关闭CDN',
                    className: "dialog_layer_v2 shutdown-cdn",
                    btnName: '确定关闭',
                    btnFn: function() {
                        var cgi = oversea ? "setHostListOv" : "setHostList";
                        dialog.hide();
                        _this.ajaxPromise(cgi, {
                            host_id: idList.join(","),
                            enable_cdn: "no"
                        }).then(function(res) {
                            generateCallbackWithData(idList, res.data);
                            tips.success("关闭CDN服务成功！");
                        });
                    }
                });
            },
            modifyProject: function(idList) {
                dialogCreate({
                    tpl: tmpl.parse(_this.tmpl.dialog_6, {
                        list: _this.data.projects
                    }),
                    width: '480',
                    title: '修改所属项目',
                    className: "dialog_layer_v2 select-project",
                    btnName: '确定',
                    btnFn: function() {
                        dialog.hide();
                        var cgi = oversea ? "setHostListOv" : "setHostList";
                        var sVal = arguments[1].find("select").val();
                        _this.ajaxPromise(cgi, {
                            host_id: idList.join(","),
                            project_id: sVal
                        }).then(function(res) {
                            if (oversea) {
                                res.data[0].project_id = sVal;
                            }
                            generateCallbackWithData(idList, res.data);
                            tips.success("修改域名所属项目成功！");
                        });
                    }
                });
            },
            modifyProjectFTP: function (idList) {
                dialogCreate({
                    tpl: tmpl.parse(_this.tmpl.dialog_6_1),
                    width: '480',
                    title: '修改所属项目',
                    className: "dialog_layer_v2 select-project",
                    btnName: '确定',
                    btnFn: function () {
                        ep.emit("dialog:modifyProject", idList);
                    }
                });
            },
            deleteCDN: function(idList) {
                if (oversea || CDN.FormSender.serverUrl=="//cdninfo.qcloud.com") {
                    dialogCreate({
                     tpl: tmpl.parse(_this.tmpl.dialog_7, {}),
                     width: '480',
                     title: '',
                     struct: "rich",
                     className: "tc-15-rich-dialog",
                     btnName: '确定',
                     btnFn: function() {
                         var cgi = oversea ? "deleteHostOv" : "delHost";
                         dialog.hide();
                         _this.ajaxPromise(cgi, {
                             host_id: idList.join(",")
                         }).then(function(res) {
                             deleteCallback(idList);
                             tips.success("删除CDN服务成功！");
                         });
                     }
                    });
                }
                else {
                    var doRequest = function(idList) {
                        mfa.verify({ api: "cdn:DeleteCdnHost" }).then(function() {
                            // MFA 验证已通过，可以调用云 API
                            api.request({
                                regionId: 1,
                                serviceType: "cdn",
                                cmd: "DeleteCdnHost",
                                data: {
                                    hostIds: idList.join(",")
                                }
                            }, {
                                secure: true
                            }).then(function(rs) {
                                if (rs.code == "4106") {
                                    doRequest();
                                }
                                deleteCallback(idList);
                                tips.success("删除CDN服务成功！");
                            });
                        }, function() {

                        });
                    }

                    dialogCreate({
                        tpl: tmpl.parse(_this.tmpl.dialog_7, {}),
                        width: '480',
                        title: '',
                        struct: "rich",
                        className: "tc-15-rich-dialog",
                        btnName: '确定',
                        btnFn: function() {
                            doRequest(idList);
                            dialog.hide();
                        }
                    });

                }
            },
            syncOversea: function (host_id_list) {
                dialogCreate({
                    tpl: tmpl.parse(_this.tmpl.sync_oversea_dialog, {}),
                    width: '550',
                    title: '部署至境外CDN',
                    className: "dialog_layer_v2",
                    btnName: '确定部署',
                    btnFn: function () {
                        dialog.hide();
                        _this.ajaxPromise('sync_host_to_oversea', {
                            host_id: host_id_list.join(","),
                        }).then(function (res) {
                            tips.success("成功部署至境外CDN！请切换至境外页面查看");
                        });
                    }
                });
            }
        };

        ep.on("dialog:startCDN", function (idList) {
            _dialog.startCDN(idList);
        });
        ep.on("dialog:startCDNsp", function (idList) {
            _dialog.startCDNsp(idList);
        });
        ep.on("dialog:closeCDN", function (idList, domestic_cdn_online) {
            _dialog.closeCDN(idList, domestic_cdn_online);
        });
        ep.on("dialog:closeCDNsp", function (idList) {
            _dialog.closeCDNsp(idList);
        });
        ep.on("dialog:modifyProject", function (idList) {
            _dialog.modifyProject(idList);
        });
        ep.on("dialog:modifyProjectFTP", function (idList) {
            _dialog.modifyProjectFTP(idList);
        });
        ep.on("dialog:deleteCDN", function (idList) {
            _dialog.deleteCDN(idList);
        });
        ep.on("dialog:syncOversea", function (host_id_list) {
            _dialog.syncOversea(host_id_list);
        });

        return _dialog;
    }


    var initTmpl = function() {
        var tmpl = {

            dialog_4: $("[data-cdn-tmpl=dialog_4]").html(),
            dialog_4S: $("[data-cdn-tmpl=dialog_4S]").html(),

            dialog_5: $("[data-cdn-tmpl=dialog_5]").html(),
            dialog_5S: $("[data-cdn-tmpl=dialog_5S]").html(),
            dialog_6: $("[data-cdn-tmpl=dialog_6]").html(),
            dialog_6_1: $("[data-cdn-tmpl=dialog_6_1]").html(),
            dialog_7: $("[data-cdn-tmpl=dialog_7]").html(),

            sync_oversea_dialog: $('[data-cdn-tmpl="sync_oversea_dialog"]').html(),
        };
        return tmpl;
    }

    var initBeeForDomainTable = function () {
        var colums = [
            {key: 'domain', name: '域名', order: false, insist: true, width: "20%"},
            {key: 'status', name: '状态', order: false, width: "12%"},
            {key: 'cname', name: 'CNAME', order: false, width: "20%"},
            {key: 'origin', name: '接入方式', order: false},
            {key: 'type', name: '业务类型', order: false},
            {key: 'project_id', name: '所属项目', order: false},
            {key: 'operation', name: '操作', order: false, width: "260px !important"}
        ];

        var defaultOriginOptions = {
            'cos': {label: 'COS源', value: 'cos'},
            'cname': {label: '自有源', value: 'cname'},
            'ftp': {label: 'FTP托管源', value: 'ftp'}
        };

        var defaultTypeOptions;
        if (oversea) {
            defaultTypeOptions = {
                'web': {label: '静态加速', value: 'web'},
                'download': {label: '下载加速', value: 'download'},
                'media': {label: '流媒体加速', value: 'media'}
            };
        }
        else {
            defaultTypeOptions = {
                'web': {label: '静态加速', value: 'web'},
                'download': {label: '下载加速', value: 'download'},
                'media': {label: '流媒体点播加速', value: 'media'},
                'live': {label: '流媒体直播加速', value: 'live'}
            };
        }

        var defaultStatusOptions = {
            '0': {label: '待认证', value: '0'},
            '1': {label: '审核中', value: '1'},
            '2': {label: '审核未通过', value: '2'},
            '4': {label: '部署中', value: '4'},
            '5': {label: '已启动', value: '5'},
            '6': {label: '已关闭', value: '6'},
            '8': {label: '未启动', value: '8'}
        };

        var headOptions = {
            status: null,
            origin: null,
            type: null,
            project: null
        };

        var b_domainTable = Bee.mount("domainTable", {
            $data : {
                canSelectTotal : true,// 是否允许所有项
                isSelectTotal: false,
                emptyTips: '暂无数据。', // 列表为空时的提示,
                // 表头/列配置
                colums: colums,
                maxHeightOffset: 10,// 最大高度的偏移值
                hasFirst: true,
            },
            statusOptions: [],
            originOptions: [],
            typeOptions: [],
            projectOptions: [],

            statusResult: [],
            originResult: [],
            typeResult: [],
            projectResult: [],
            events: {
                'change .tc-15-first-checkbox': function(e) {
                    b_domainTable.hideSelectAllTips($('[data-select-total]'));
                },
                'click tr [_dn_cdn_action="manage"]': function(e) {
                    var host_id = $(e.target).attr('_dn_cdn_host_id');
                    if (oversea) {
                        router.navigate("/cdn/access_oversea/manage/" + host_id);
                    }
                    else {
                        router.navigate("/cdn/access/manage/" + host_id);
                    }
                },
                'click tr [_dn_cdn_action="copy"]': function(e) {
                    var host_id = $(e.target).attr('_dn_cdn_host_id');
                    var dialogStr = tmpl.parse($('[data-cdn-tmpl="copy"]').html(), {list: _this.data.projects});
                    dao.getHostInfo({
                        data: {
                            host_id: host_id
                        },
                        success: {
                            "0": function(rs) {
                                var hostData = rs.data;
                                dialog.create(dialogStr, 480, '', {
                                    title: "复制域名",
                                    preventResubmit: true,
                                    "class": "tc-15-rich-dialog",
                                    onload: function($dialog) {
                                        $dialog.find('[_dn_cdn_host]').val(hostData.host);
                                        $dialog.find('[_dn_cdn_project_id]').val(hostData.project_id);
                                        if (hostData.host_type != "cname") {
                                            $dialog.find('[_dn_cdn_fwd]').parents("li").hide();
                                        }
                                        else {
                                            $dialog.find('[_dn_cdn_fwd]').val(hostData.fwd_host);
                                        }
                                    },
                                    button: {
                                        "确定": function($btn, $dialog) {
                                            var host = $.trim($dialog.find('[_dn_cdn_host]').val());
                                            var project_id = $dialog.find('[_dn_cdn_project_id]').val();
                                            var cname_host = $('[_dn_cdn_share_cname]').prop("checked");
                                            var copyData = {};
                                            if (!cdnUtil.testDomain(host)) {
                                                $dialog.find('[_dn_cdn_host]').parent().addClass("is-error");
                                                return;
                                            }
                                            $dialog.find('[_dn_cdn_host]').parent().removeClass("is-error");
                                            copyData.host = host;
                                            copyData.host_id = host_id;
                                            copyData.project_id = project_id;
                                            if (cname_host) {
                                                copyData.cname_host = hostData.host;
                                            }

                                            if (hostData.host_type == "cname") {
                                                copyData.fwd_host = $dialog.find('[_dn_cdn_fwd]').val();
                                            }
                                            dao.copy_host({
                                                data: copyData,
                                                success: {
                                                    0: function (rs) {
                                                        tips.success("域名复制成功");
                                                        dialog.hide();
                                                        _this.main();
                                                    },
                                                    default: function (rs) {
                                                        tips.error(rs.msg);
                                                    }
                                                }
                                            });
                                            dialog.hide();
                                        }
                                    }
                                });
                            },
                            "default": function(rs) {
                                tips.error(rs.msg || defaultErrorMsg);
                            }
                        }
                    });
                },
                'click tr [_dn_cdn_action="audit"]': function(e) {
                    var host = $(e.target).attr('_dn_cdn_domain');
                    _this.ajaxPromise('audit_host', {
                        host: host
                    }).then(function(res) {
                        tips.success('审核通过！');
                        _this.main();
                    });
                }
            },
            getHeadContent: function(col) {
                if(col.key === 'status') {
                    return '<grid-view-header-filter b-ref="statusFilter" b-with="{ ready: statusFilterReady.bind(this.$root), filterOptions: statusOptions, filterResult: statusResult, col: col, change: statusChange.bind(this.$root)}"></grid-view-header-filter>'
                }
                else if (col.key === 'cname') {
                    return '<span>CNAME</span>' +
                            '<div class="tc-15-bubble-icon tc-15-triangle-align-center">   <i class="tc-icon icon-what"></i>' +
                                '<div class="tc-15-bubble tc-15-bubble-top">' +
                                    '<div class="tc-15-bubble-inner">此域名是加速域名CNAME到CDN节点上的地址，直接访问此域名则无法获取正确资源信息</div>' +
                                '</div>' +
                            '</div>';
                }
                else if (col.key === 'project_id') {
                    return '<grid-view-header-filter b-ref="projectFilter" b-with="{ ready: projectFilterReady.bind(this.$root), filterOptions: projectOptions, filterResult: projectResult, col: col, change: projectChange.bind(this.$root)}"></grid-view-header-filter>'
                }
                else if (col.key === 'origin') {
                    return '<grid-view-header-filter b-ref="originFilter" b-with="{ ready: originFilterReady.bind(this.$root), filterOptions: originOptions, filterResult: originResult, col: col, change: originChange.bind(this.$root)}"></grid-view-header-filter>'
                }
                else if (col.key === 'type') {
                    return '<grid-view-header-filter b-ref="typeFilter" b-with="{ ready: typeFilterReady.bind(this.$root), filterOptions: typeOptions, filterResult: typeResult, col: col, change: typeChange.bind(this.$root)}"></grid-view-header-filter>'
                }
            },
            statusFilterReady: function(filter) {
            },
            projectFilterReady: function(filter) {
            },
            originFilterReady: function(filter) {
                // 规避英文版列表头出现的换行问题
                $(filter.$el).find("span.tc-15-filtrate-btn").css("white-space", "nowrap");
            },
            typeFilterReady: function(filter) {
                // 规避英文版列表头出现的换行问题
                $(filter.$el).find("span.tc-15-filtrate-btn").css("white-space", "nowrap");
            },
            statusChange: function(options) {
                if (!options || options.length == 0) {
                    headOptions.status = null;
                    ep.emit("root:tableFilterUpdate", {
                        turnPage: 1
                    });
                    return
                }
                // 规避初始化时全选，域名状态变更后消失的问题
                if (options.length < this.statusOptions.length) {
                    tableStatus.statusAll = false;
                }
                else {
                    tableStatus.statusAll = true;
                }
                headOptions.status = {};
                if (options) {
                    _.forEach(options, function(item, index) {
                        headOptions.status[item] = true;
                    });
                }
                else {
                    headOptions.status = null;
                }
                ep.emit("root:tableFilterUpdate", {
                    turnPage: 1
                });
                for (var i = 0; i < this.statusOptions.length; i++) {
                    var checked = options ? options.indexOf(this.statusOptions[i].value) > -1 : false;
                    this.statusOptions.$set(i, {
                        checked: checked
                    });
                }
                tableStatus.statusResult = options;
            },
            originChange: function(options) {
                if (!options || options.length == 0) {
                    return
                }
                headOptions.origin = {};
                if (options) {
                    _.forEach(options, function(item, index) {
                        headOptions.origin[item] = true;
                    });
                }
                else {
                    headOptions.origin = null;
                }
                ep.emit("root:tableFilterUpdate", {
                    turnPage: 1
                });
                for (var i = 0; i < this.originOptions.length; i++) {
                    var checked = options ? options.indexOf(this.originOptions[i].value) > -1 : false;
                    this.originOptions.$set(i, {
                        checked: checked
                    });
                }
                tableStatus.originResult = options;
            },
            projectChange: function(options) {
                if (!options || options.length == 0) {
                    headOptions.project = null;
                    ep.emit("root:tableFilterUpdate", {
                        turnPage: 1
                    });
                    return
                }
                if (options.length < this.projectOptions.length) {
                    tableStatus.projectAll = false;
                }
                else {
                    tableStatus.projectAll = true;
                }
                headOptions.project = {};
                if (options) {
                    _.forEach(options, function(item, index) {
                        headOptions.project[item] = true;
                    });
                }
                else {
                    headOptions.project = null;
                }
                ep.emit("root:tableFilterUpdate", {
                    turnPage: 1
                });
                for (var i = 0; i < this.projectOptions.length; i++) {
                    var checked = options ? options.indexOf(this.projectOptions[i].value) > -1 : false;
                    this.projectOptions.$set(i, {
                        checked: checked
                    });
                }
                tableStatus.projectResult = options;
            },
            typeChange: function(options) {
                if (!options || options.length == 0) {
                    return
                }
                headOptions.type = {};
                if (options) {
                    _.forEach(options, function(item, index) {
                        headOptions.type[item] = true;
                    });
                }
                else {
                    headOptions.type = null;
                }
                ep.emit("root:tableFilterUpdate", {
                    turnPage: 1
                });
                for (var i = 0; i < this.typeOptions.length; i++) {
                    var checked = options ? options.indexOf(this.typeOptions[i].value) > -1 : false;
                    this.typeOptions.$set(i, {
                        checked: checked
                    });
                }
                tableStatus.typeResult = options;
            },
            getCellContent: function(val, item, col) {
                var res = val || "";
                if (col.key == 'operation') {
                    var res = '<div class="">';
                    var hostReg = /^.+\.myqcloud\.com$/g;
                    res += '<a href="javascript:void(0)" _dn_cdn_action="manage" _dn_cdn_host_id=\"' + item.id + '\">管理</a>';
                    if (!oversea && !hostReg.test(item.domain) && overseaCustomer) {
                        res += '<i class="black-seperate-line-icon" role="separator"></i><a href="javascript:void(0)" _dn_cdn_action="copy" _dn_cdn_host_id=\"' + item.id + '\">复制并创建</a>';
                    }
                    if (item.status === 2) {
                        res += '<i class="black-seperate-line-icon" role="separator"></i>' +
                            '<a href="javascript:void(0)" _dn_cdn_action="audit" _dn_cdn_domain=\"' + item.domain + '\">重新审核</a>';
                    }
                    res += '</div>';
                    return res;
                }
                else if (col.key == 'domain') {
                    var httpsClass = '',
                        httpsText = '',
                        disabledClass = '',
                        disabledText = '',
                        disabledHTML = '',
                        httpsHTML = '',
                        domainHTML = ''
                    if (item.ssl_status == 3) {
                        switch(item.ssl_type) {
                            case 0: httpsClass = ''; break;
                            case 2:
                            case 4:
                            case 5:
                            case 6: {
                                httpsClass = 'icon-lock-pri';
                                httpsText = '私用https';
                                break;
                            }
                            case 1:
                            case 3: {
                                httpsClass = 'icon-lock-pub';
                                httpsText = '公用https';
                                break;
                            }
                        }
                    }
                    else if (item.https && item.https.type != 0) {
                        httpsClass = 'icon-lock-pri';
                        httpsText = '私用https';
                    }
                    if (httpsClass) {
                        httpsHTML = '<div class="tc-15-bubble-icon tc-15-triangle-align-start">' +
                                    '<i class=\"' + httpsClass + '\"></i>' +
                                    '<div class="tc-15-bubble tc-15-bubble-top">' +
                                        '<div class="tc-15-bubble-inner">' + httpsText + '</div>' +
                                    '</div>' +
                                '</div>';
                    }

                    switch (item.disabled) {
                        case 3:
                        {
                            if (item.readonly != 0) {
                                disabledClass = 'icon-offline';
                                disabledText = '<p>该域名涉嫌违规内容（涉黄/涉赌/涉毒/涉政）已被封禁，执行解析回源并下线，更多细节及处理办法，您可以 <a target="_blank" href="https://"+CDN.domain+"/workorder">提交工单</a> 联系我们！</p>';
                            }
                            break;
                        }
                        case 4:
                        {
                            if (item.readonly != 0) {
                                disabledClass = 'icon-offline';
                                disabledText = '<p>该域名受到大规模DDOS攻击，已被封禁，</p>' +
                                    '<p>所有请求均直接返回403，更多详情及解封</p>' +
                                    '<p>办法请 <a target="_blank" href="https://"+CDN.domain+"/workorder">提交工单</a> 联系我们</p>';
                            }
                            break;
                        }
                        case 7:
                        case 8:
                        {
                            if (item.lock_msg.indexOf("capping=") !== 0) {
                                disabledClass = 'icon-limit';
                                break;
                            }
                            var lock_msg_arr = item.lock_msg.slice("capping=".length).split(",");
                            var timeStr = lock_msg_arr[0];
                            var unitMapQuantity = {
                                "K": 1000,
                                "M": 1000 * 1000,
                                "G": 1000 * 1000 * 1000,
                                "T": 1000 * 1000 * 1000 * 1000
                            };
                            var fluxStr = (Number(lock_msg_arr[1]) / unitMapQuantity[lock_msg_arr[2]]) + lock_msg_arr[2] + "bps";
                            var hyStr = lock_msg_arr[3] == "yes" ? "请求回源" : "关闭服务";
                            disabledClass = 'icon-limit';
                            disabledText = '<p>域名于 <span class=\'text-danger\'>' + timeStr + '</span> 超出封顶阈值</p>' +
                                '<p><span class=\'text-danger\'>' + fluxStr + '</span>，已配置为 <span class=\'text-danger\'>' + hyStr + '</span>，您可以手动</p>' +
                                '<p>开启恢复CDN服务。</p>';
                            break;
                        }
                    }

                    // 检查是否存在运维锁
                    if (!disabledClass) {
                        if (item.readonly == 1) {
                            disabledClass = 'icon-locked';
                            disabledText = '<p>该域名由于存在特殊配置已被锁定，任何域名</p>' +
                                '<p>相关操作需 <a target="_blank" href="https://"+CDN.domain+"/workorder">提交工单</a> 进行人工处理</p>'
                        }
                    }
                    if (disabledClass) {
                        if (disabledText && CDN.base.language == "en") {
                            disabledHTML = '<div class="tc-15-bubble-icon tc-15-triangle-align-start">' +
                                '<i class=\"tc-icon ' + disabledClass + '\"></i>' +
                                '<div class="tc-15-bubble tc-15-bubble-top" style="width: 500px;">' +
                                '<div class="tc-15-bubble-inner">' + disabledText + '</div>' +
                                '</div>' +
                                '</div>';
                        } else if (disabledText) {
                            disabledHTML = '<div class="tc-15-bubble-icon tc-15-triangle-align-start">' +
                                '<i class=\"tc-icon ' + disabledClass + '\"></i>' +
                                '<div class="tc-15-bubble tc-15-bubble-top">' +
                                '<div class="tc-15-bubble-inner">' + disabledText + '</div>' +
                                '</div>' +
                                '</div>';
                        } else {
                            disabledHTML = '<div class="tc-15-bubble-icon tc-15-triangle-align-start">' +
                                '<i class=\"tc-icon ' + disabledClass + '\"></i>' +
                                '</div>';
                        }
                    }

                    domainHTML = '<span class=\'host-icon text-overflow\' title=\'' + item.domain + '\'><a href="javascript:void(0)" _dn_cdn_action="manage" _dn_cdn_host_id=\"' + item.id + '\">' + item.domain + '</a></span>';
                    return '<div style="white-space: nowrap;">'
                                + disabledHTML
                                + httpsHTML
                                + domainHTML +
                            '</div>';
                }
                else if (col.key == 'origin') {
                    switch(item.origin) {
                        case "cname": res = "自有源";break;
                        case "cos": res = "COS源";break;
                        case "ftp": res = "FTP托管源";break;
                    }
                }
                else if (col.key == 'type') {
                    if (oversea) {
                        switch(item.type) {
                            case "web": res = "静态加速";break;
                            case "download": res = "下载加速";break;
                            case "media": res = "流媒体加速";break;
                        }
                    }
                    else {
                        switch(item.type) {
                            case "web": res = "静态加速";break;
                            case "download": res = "下载加速";break;
                            case "media": res = "流媒体点播加速";break;
                            case "live": res = "流媒体直播加速";break;
                        }
                    }
                }
                else if (col.key == 'project_id') {
                    res = projectMap[item.project_id] || '';
                }
                else if (col.key == 'status') {
                    switch(item.status) {
                        case 0: return '<i class="n-error-icon"></i><span class="text-overflow">待认证</span>';
                        case 1: return '<i class="records-icon"></i><span class="text-overflow">审核中</span>';
                        case 2: return '<i class="n-error-icon"></i><span class="text-overflow">审核未通过</span>';
                        case 4: return '<i class="n-restart-icon"></i><span class="text-overflow">部署中</span>';
                        case 5: return '<i class="n-success-icon"></i><span class="text-overflow">已启动</span>';
                        case 6: return '<i class="n-shutdown-icon"></i><span class="text-overflow">已关闭</span>';
                        case 8: return '<i class="n-shutdown-icon"></i><span class="text-overflow">未启动</span>';
                    }
                    return '未知状态';
                }
                return '<span class="text-overflow" title="' + res + '">' +res+ '</span>';
            },
            getData: function(opts) {
                var res = hostData || [];
                var page = opts.page;
                var count = opts.count;
                if (res.length > 0) {
                    tableStatus.page = opts.page;
                    tableStatus.count = opts.count;
                    temp_page = opts.page;
                }
                if(!opts.type){
                    ep.emit("root:tableFilterUpdate", opts);
                }
            },
            updateFilterOptions: function() {
                var statusOptions = [],
                    originOptions = [],
                    typeOptions = [],
                    projectOptions = [];

                var statusResult = [],
                    originResult = [],
                    typeResult = [],
                    projectResult = [];

                var originHasMap = {},
                    typeHasMap = {},
                    projectHasMap = {};

                for (var key in defaultStatusOptions) {
                    statusOptions.push(defaultStatusOptions[key]);
                    statusResult.push(defaultStatusOptions[key].value);
                }

                _.forEach(hostData, function(item) {
                    if (defaultOriginOptions[item.origin] && !originHasMap[item.origin]) {
                        originHasMap[item.origin] = true;
                        originOptions.push(defaultOriginOptions[item.origin]);
                        originResult.push(defaultOriginOptions[item.origin].value);
                    }
                    if (defaultTypeOptions[item.type] && !typeHasMap[item.type]) {
                        typeHasMap[item.type] = true;
                        typeOptions.push(defaultTypeOptions[item.type]);
                        typeResult.push(defaultTypeOptions[item.type].value);
                    }
                    if (!projectHasMap[item.project_id]) {
                        projectHasMap[item.project_id] = true;
                        if (!projectMap[item.project_id]) {
                            projectOptions.push({
                                label: "",
                                value: item.project_id
                            });
                            projectResult.push(item.project_id);
                        }
                        else {
                            projectOptions.push({
                                label: projectMap[item.project_id],
                                value: item.project_id
                            });
                            projectResult.push(item.project_id);
                        }
                    }
                });
                if (tableStatus.statusAll) {
                    tableStatus.statusResult = statusResult;
                }
                if (tableStatus.projectAll) {
                    tableStatus.projectResult = projectResult;
                }
                if (tableStatus.statusResult.length == 0) {
                    tableStatus.statusResult = statusResult;
                    tableStatus.statusAll = true;
                }
                if (tableStatus.originResult.length == 0) {
                    tableStatus.originResult = originResult;
                }
                if (tableStatus.typeResult.length == 0) {
                    tableStatus.typeResult = typeResult;
                }
                if (tableStatus.projectResult.length == 0) {
                    tableStatus.projectResult = projectResult;
                    tableStatus.projectAll = true;
                }

                this.$set('statusOptions', statusOptions);
                this.$set('originOptions', originOptions);
                this.$set('typeOptions', typeOptions);
                this.$set('projectOptions', projectOptions);

                if (manageBackToAccess) {
                    statusResult = tableStatus.statusResult;
                    originResult = tableStatus.originResult;
                    typeResult = tableStatus.typeResult;
                    projectResult = tableStatus.projectResult;
                    if (statusOptions.length != statusResult.length) {
                        this.$set('statusResult', statusResult);
                    }
                    if (originOptions.length != originResult.length) {
                        this.$set('originResult', originResult);
                    }
                    if (typeOptions.length != typeResult.length) {
                        this.$set('typeResult', typeResult);
                    }
                    if (projectOptions.length != projectResult.length) {
                        this.$set('projectResult',  projectResult);
                    }

                    // this.$set('statusResult', statusResult);
                    // this.$set('originResult', originResult);
                    // this.$set('typeResult', typeResult);
                    // this.$set('projectResult',  projectResult);
                }
            },
            updateDisplayData: function(opts) {
                opts = opts || {};
                var searchData = [];
                var page = opts.page            || this.$data.page;
                var count = opts.count          || this.$data.count;

                _.forEach(hostData, function (item, index) {
                    if ((!headOptions.status || headOptions.status[item.status])
                        && (!headOptions.origin || headOptions.origin[item.origin])
                        && (!headOptions.type || headOptions.type[item.type])
                        && (!headOptions.project || headOptions.project[item.project_id])) {
                        searchData.push(item);
                    }
                });

                if (opts.turnPage) {
                    page = opts.turnPage;
                }
                temp_page = page;
                this.setData({
                    totalNum: searchData.length,
                    page: page,
                    count: count,
                    list: searchData.slice((page - 1) * count, page * count),
                });
            }
        })

        ep.on("root:hostDataUpdate", function () {
            b_domainTable.updateFilterOptions();
        });
        ep.on("root:tableFilterUpdate", function (opts) {
            if (opts && opts.fromTag) {
                b_domainTable.projectChange([]);
            } else {
                b_domainTable.updateDisplayData(opts);
            }
        });

        b_domainTable.$watch("getSelected(list)", function (newSelected) {
            if (newSelected.length > 0) {
                $('[_dn_cdn_startCDN_button]').removeClass("disabled");
                $('[_dn_cdn_sync_button]').removeClass("disabled");
            } else {
                $('[_dn_cdn_startCDN_button]').addClass("disabled");
                $('[_dn_cdn_sync_button]').addClass("disabled");
            }
        });

        return b_domainTable;
    };

    var initBeeForDropdownList = function () {
        var b_dropdownList = Bee.mount('dropdownList', {
            listTpl: '<li data-item role="presentation"' +
            'b-repeat="item in list | _filter : filterKey"' +
            'title="{{item.title || item.label}}"' +
            'class="{{item.$disabled ? \'disabled\' : \'\'}}">' +
            '<a role="menuitem" href="javascript:;">{{item.label}}</a>' +
            '</li>',
            $data: {
                popup: false,
                simulateSelect: false,
                label: '更多操作',
                filter: false,
                list: [
                    {label: "关闭CDN", value: "closeCDN"},
                    {label: "修改所属项目", value: "modifyProject"},
                    {label: "编辑标签", value: "modifyTag"},
                    {label: "删除", value: "deleteCDN"}
                ]
            },
            selectCallback: {
                "closeCDN": function () {

                    var selected = b_domainTable.getSelected();

                    var host;

                    // 检查有无未处于“已关闭状态”的item。
                    host = _.find(selected, function (item) {
                        return item.status != 5;
                    });
                    if (host) {
                        return tips.error('关闭操作只能作用于“已启动”状态的域名，请重新选择。');
                    }

                    // 特殊情况
                    host = _.find(selected, function (item) {
                        return item.cname.indexOf("cloud.cdntip.com") > -1;
                    });

                    var idList = [];
                    var domestic_cdn_online = false;
                    _.forEach(selected, function (item) {
                        idList.push(item.id);
                        if (item.domestic_cdn_online == true || item.oversea_cdn_online) {
                            domestic_cdn_online = true;
                        }
                    });

                    if (host) {
                        ep.emit("dialog:closeCDNsp", idList);
                    } else {
                        ep.emit("dialog:closeCDN", idList, domestic_cdn_online);
                    }
                },
                "modifyProject": function () {

                    var selected = b_domainTable.getSelected();

                    var host;

                    // 只有已启动或部署中状态才可以进行操作。
                    host = _.find(selected, function (item) {
                        return item.status != 5 && item.status != 4;
                    });
                    if (host) {
                        return tips.error('只可修改“已启动”或“部署中”状态的域名。');
                    }

                    // 特殊情况
                    host = _.find(selected, function (item) {
                        return item.origin == 'ftp';
                    });

                    var idList = [];
                    _.forEach(selected, function (item) {
                        idList.push(item.id);
                    });

                    if (host) {
                        ep.emit("dialog:modifyProjectFTP", idList);
                    } else {
                        ep.emit("dialog:modifyProject", idList);
                    }
                },
                "deleteCDN": function () {

                    var selected = b_domainTable.getSelected();

                    var host;

                    // 只有待认证 和审核未通过的才可以进行操作。
                    host = _.find(selected, function (item) {
                        return item.status != 1 && item.status != 2 && item.status != 6;
                    });
                    if (host) {
                        return tips.error(' 删除操作不能作用于“已启动”和“部署中”状态的域名，请重新选择。');
                    }


                    var idList = [];
                    _.forEach(selected, function (item) {
                        idList.push(item.id);
                    });
                    ep.emit("dialog:deleteCDN", idList);
                },
                "modifyTag": function () {
                    var selected = b_domainTable.getSelected();
                    ep.emit("dialog:modifyTag", selected);
                },
            },
            onSelect: function (selected) {
                var value = selected.value;
                if (typeof this.selectCallback[value] === 'function') {
                    this.selectCallback[value]();
                }
            }
        });

        b_domainTable.$watch("getSelected(list)", function (newSelected) {
            var list = b_dropdownList.$data.list;
            _.forEach(list, function (item, index) {
                item.$disabled = newSelected.length === 0;
                b_dropdownList.$data.list.$set(index, item);
            });
        });

        return b_dropdownList;

    }

    var initContextMenu = function (object) {
        var getItem = function (el) {
            var hostId = $(el).find("[_dn_cdn_host_id]")
                .attr("_dn_cdn_host_id");
            return _.find(hostData, function (item) {
                return Number(item.id) == Number(hostId);
            });
        }

        var menuCallback = [
            {
                "startCDN": {
                    "name": "启动CDN",
                    "callback": function(el) {
                        var item = getItem(el);
                        if (item.cname.indexOf("cloud.cdntip.com") > -1) {
                            return ep.emit("dialog:startCDNsp", [item.id]);
                        }
                        ep.emit("dialog:startCDN", [item.id]);
                    }
                }
            },
            {
                "closeCDN": {
                    "name": "关闭CDN",
                    "callback": function(el) {
                        var item = getItem(el);
                        if (item.cname.indexOf("cloud.cdntip.com") > -1) {
                            return ep.emit("dialog:closeCDNsp", [item.id]);
                        }
                        ep.emit("dialog:closeCDN", [item.id]);
                    }
                }
            },
            {
                "modifyProject": {
                    "name": "修改所属项目",
                    "callback": function(el) {
                        var item = getItem(el);
                        if (item.origin == 'ftp') {
                            return ep.emit("dialog:modifyProjectFTP", [item.id]);
                        }
                        ep.emit("dialog:modifyProject", [item.id]);
                    }
                }
            },
            {
                "deleteCDN": {
                    "name": "删除",
                    "callback": function(el) {
                        var item = getItem(el);
                        ep.emit("dialog:deleteCDN", [item.id]);
                    }
                }
            }
        ];

        new contextMenu({
            object: object,
            selector: 'tbody tr',
            getData: function(el) {
                var menuList = {};
                var item = getItem(el);
                if (item) {
                    if (item.status == "6") {
                        menuList = $.extend(false, {}, menuCallback[0], menuCallback[2], menuCallback[3]);
                    } else {
                        menuList = $.extend(false, {}, menuCallback[1], menuCallback[2], menuCallback[3]);
                    }
                }
                // 灰化无法使用的右键菜单
                setTimeout(function() {
                    // 规避空异常
                    if (item) {
                        $('#contextMenu li').removeClass("disabled");
                        if (item.status == "5" || item.status == "4") {
                            if (_this.data.show_projects) {
                                $('#contextMenu li[data-name="deleteCDN"]').addClass("disabled");
                            } else {
                                $('#contextMenu li[data-name="modifyProject"]').addClass("disabled");
                                $('#contextMenu li[data-name="deleteCDN"]').addClass("disabled");
                            }
                        } else if (item.status == "6") {
                            $('#contextMenu li[data-name="modifyProject"]').addClass("disabled");
                        } else if (item.status == 1 || item.status == 2) {
                            $('#contextMenu li[data-name="closeCDN"]').addClass("disabled");
                            $('#contextMenu li[data-name="modifyProject"]').addClass("disabled");
                        }
                        $('#contextMenu li').attr("hotrep", "cdn.access.ontext_menu");
                    }
                },1);
                return [menuList];
            }
        });
    }

    var initEvent = function () {
        // 添加域名按钮
        $('[_dn_cdn_main_container]').on('click', '[_dn_cdn_add_button]', function (e) {
            if (oversea) {
                router.navigate("/cdn/access_oversea/guid");
            }
            else {
                router.navigate("/cdn/access/guid");
            }
        });
        $('[_dn_cdn_main_container]').on("click", '[_dn_cdn_startCDN_button]', function() {
            if ($(this).hasClass("disabled")) {
                return;
            }

            var selected = b_domainTable.getSelected();

            if (selected.length <= 0) {
                return tips.error("请先选择域名");
            }

            var host;

            // 检查有无未处于“已关闭状态”的item。
            host = _.find(selected, function (item) {
                return item.status != 6;
            });
            if (host) {
                return tips.error('启动操作只能作用于“已关闭”状态的域名，请重新选择。');
            }

            // 特殊情况
            host = _.find(selected, function (item) {
                return item.cname.indexOf("cloud.cdntip.com") > -1;
            });

            var idList = [];
            _.forEach(selected, function (item) {
                idList.push(item.id);
            });

            if (host) {
                ep.emit("dialog:startCDNsp", idList);
            } else {
                ep.emit("dialog:startCDN", idList);
            }
        });
        // 部署到境外CDN按钮
        $("[_dn_cdn_main_container]").on("click", '[_dn_cdn_sync_button]', function (e) {
            if ($(this).hasClass("disabled")) {
                return;
            }

            var selected = b_domainTable.getSelected();
            var host_id_list = [];
            if (selected.length <= 0) {
                return tips.error("请先选择域名");
            }
            _.forEach(selected, function (item) {
                host_id_list.push(item.id);
            });

            ep.emit("dialog:syncOversea", host_id_list);
        });

        $("[_dn_cdn_refresh_table]").on("click", function(e) {
            manageBackToAccess = true;
            _this.main();
        });

        if (!oversea) {
        // 下载域名配置
            $('[_dn_cdn_export_domain]').click(function(e) {
                var url = CDN.FormSender.serverUrl + CDN.FormSender.commonPath + 'action=download_host_list'
                var param = {
                    g_tk: util.getACSRFToken()
                };

                var temp_form = document.createElement("form");
                temp_form.action = url;
                temp_form.target = "_blank";
                temp_form.method = "post";
                temp_form.style.display = "none";
                for (var x in param) {
                    var opt = document.createElement("textarea");
                    opt.name = x;
                    opt.value = param[x];
                    temp_form .appendChild(opt);
                }
                document.body.appendChild(temp_form);
                temp_form.submit();
            });
        }
        else {
            $('[_dn_cdn_export_domain]').hide();
        }
    }

    var initOversea = function () {
        ep.fail(function (err) {
            console.error('overseaLogic error', err)
        });

        _this.ajaxPromise('get_white_list').then(function (res) {
            ep.done('userWhiteList')(null, res.data);
        });

        ep.all('userWhiteList', function(userWhiteList) {
            var $syncOverseaBtn = $('[_dn_cdn_sync_button]');
            var isVip = userWhiteList.indexOf("oversea_console") >= 0;
            if (isVip && !oversea) {
                $syncOverseaBtn.show();
            }
        });

        if (CDN.white_list.load == true) {
            ep.done('userWhiteList')(null, CDN.white_list.list);
        }
        else {
            _this.ajaxPromise('get_white_list').then(function(res) {
                ep.done('userWhiteList')(null, res.data);
            });
        }
    };

    var initSearchBar = function () {
        var searchBar = new Vue({
            el: '[_dn_cdn_search]',
            components: {
                qcDialog: qcvue.QcDialog,
                qcBubble: qcvue.QcBubble,
                searchableDropdown: qcvueExtra.searchableDropdown,
            },
            directives: {
                clickOutside: qcvueExtra.clickOutsideDirective,
            },
            data: {
                filterTypes: [
                    {
                        type: 'domain',
                        label: '域名',
                    },
                    {
                        type: 'origin',
                        label: '源站',
                    },
                    {
                        type: 'tag',
                        label: '标签',
                    },
                    {
                        type: 'project',
                        label: '所属项目',
                        autocomplete: true,
                        list: [
                            { label: '全部项目', value: -1 },
                        ],
                    },
                ],

                active: false,
                filters: [
                    {
                        active: false,
                        label: '所属项目',
                        value: '全部项目',
                        inputValue: '',
                        oldInputValue: '',
                        showBubble: false,
                        dropdown: {
                            showKey: false,
                            showValue: false,
                            list: [],
                            value: []
                        },
                        backup: {
                            label: '所属项目',
                            value: '全部项目',
                        },
                        isSpecial: true,
                        _key: Date.now(),
                    },
                ],
                newFilter: {
                    active: false,
                    label: undefined,
                    value: undefined,
                    inputValue: '',
                    oldInputValue: '',
                    showBubble: false,
                    dropdown: {
                        showKey: true,
                        showValue: false,
                        list: [],
                        value: []
                    },
                },
            },
            created: function () {
                var self = this;
                ep.on("root:hostDataUpdate", function () {
                    var filter = self.filterTypes[3];
                    filter.list = _.map(projectList, 'name');
                    filter.list.unshift('全部项目');

                    self.filterTypes.splice(3, 1, filter);
                });

                self.filters = tableStatus.searchFilters || self.filters;
                self.search();
            },
            computed: {
                availableFilterTypes: function () {
                    return _.difference(_.map(this.filterTypes, 'label'), _.map(this.filters, 'label'));
                },
            },
            methods: {
                enter: function (index, event) {
                    this.active = true;
                    var self = this;
                    var el = index === -1 ? this.$refs.newFilter : this.$refs.filter[index];
                    this.$nextTick(function () {
                        if (!$(el).is(':focus')) {
                            el.focus();
                            el.setSelectionRange(self.newFilter.inputValue.length, self.newFilter.inputValue.length);
                            self._showDropdownList(index);
                        }
                    })

                    if (event) {
                        event.stopPropagation();
                    }
                },
                exit: function () {
                    this.active = false;
                    this.normalize();
                },
                clear: function () {
                    this.filters = [];
                    this.newFilter = {
                        active: false,
                        label: undefined,
                        value: undefined,
                        inputValue: '',
                        oldInputValue: '',
                        showBubble: false,
                        dropdown: {
                            showKey: true,
                            showValue: false,
                            list: [],
                            value: []
                        },
                    };
                    this.handleInput(-1);
                },
                showHelpDialog: function () {
                    ep.emit("dialog:showHelpDialog");
                },
                normalize: function () {
                    this.filters = _.map(this.filters, function (filter) {
                        filter.label = filter.backup.label;
                        filter.value = filter.backup.value;
                        filter.active = false;
                        return filter;
                    });
                },
                editFilter: function (index, event) {
                    if (!this.active) return this.active = true;
                    var filter = this.filters[index];
                    if (filter.isSpecial) {
                        filter.inputValue = filter.label + ': ' + filter.value;
                    } else {
                        filter.inputValue = filter.label;
                    }
                    filter.active = true;
                    filter.backup.label = filter.label;
                    filter.backup.value = filter.value;
                    this.handleInput(index);
                    var self = this;
                    this.newFilter.dropdown.showKey = false;
                    this.newFilter.dropdown.showValue = false;
                    this.$nextTick(function () {
                        self.$refs.filter[index].focus();
                    });
                    event.stopPropagation();
                },
                removeFilter: function (index) {
                    this.filters.splice(index, 1);
                    this.search();
                },
                confirmFilter: function (index) {
                    var filter = index === -1 ? this.newFilter : this.filters[index];
                    if (!filter.inputValue) return;
                    var match = filter.inputValue.match(/^(.*?)(\:\s*(.*))?$/);
                    var label = match && match[1] || '';
                    var value = match && match[3] || '';
                    var isSpecialFilter = _.findIndex(this.filterTypes, function (type) { return type.label === label; }) >= 0;

                    filter.isSpecial = isSpecialFilter;
                    if (isSpecialFilter) {
                        if (filter.dropdown.list && filter.dropdown.list.length) {
                            filter.value = _.intersection(filter.dropdown.value, filter.dropdown.list).join(' | ');
                        } else {
                            filter.value = value.trim();
                        }
                    } else {
                        filter.label = filter.inputValue;
                        filter.value = '';
                    }
                    filter.active = false;
                    filter.backup = { label: filter.label, value: filter.value };
                    filter._key = filter._key || Date.now();
                    if (index === -1) {
                        this.filters.splice(this.filters.length, 0, filter);
                        this.newFilter = {
                            active: false,
                            label: undefined,
                            value: undefined,
                            inputValue: '',
                            oldInputValue: '',
                            showBubble: false,
                            dropdown: {
                                showKey: true,
                                showValue: false,
                                list: [],
                                value: []
                            },
                        };
                    } else {
                        this.filters.splice(index, 1, filter);
                    }
                    this.search();
                },
                handleKeydown: function (index, event) {
                    var keycode = event.which || event.keyCode;
                    var filter = index === -1 ? this.newFilter : this.filters[index];
                    var map = {
                        8: 'backspace',
                        9: 'tab',
                        13: 'enter',
                        37: 'left',
                        38: 'up',
                        39: 'right',
                        40: 'down',
                    };

                    switch (map[keycode]) {
                        case 'enter':
                        case 'tab':
                            // confirm new filter
                            this.confirmFilter(index);
                            event.preventDefault();
                            break;
                        case 'left':
                        case 'right':
                            // set cursor
                            this._showDropdownList(index);
                            break;
                        case 'up':
                        case 'down':
                            event.preventDefault();
                            break;
                        case 'backspace':
                            // delete tag
                            if (index === -1 && !filter.inputValue) this.filters.splice(this.filters.length - 1, 1);
                            else if (index >= 0 && filter.inputValue.length <= 1) this.filters.splice(index, 1);
                    }
                },
                handleInput: function (index, event) {
                    var filter = index === -1 ? this.newFilter : this.filters[index];
                    if (!filter) return;
                    var value = event ? event.target.value : filter.inputValue;
                    var deleting = filter.oldInputValue && value.length < filter.oldInputValue.length;

                    if (!deleting) {
                        var labelOnly = [':', '：'].indexOf(value[value.length - 1]) >= 0 ? value.substr(0, value.length - 1) : value;
                        var isSpecialFilter = _.findIndex(this.filterTypes, function (type) { return type.label === labelOnly; }) >= 0;
                        if (isSpecialFilter) value = labelOnly + ': ';
                    }

                    var width = Math.max(5, 5 + Math.ceil($(this.$refs.newFilterText).text(value).width()));
                    if (index === -1) {
                        $(this.$refs.newFilter).css('width', width + 'px').parent().css('width', width + 'px');
                    } else {
                        $(this.$refs.filter[index]).css('width', width + 'px').parent().css('width', width + 'px');
                    }

                    filter.inputValue = value;
                    this._updateFilter(index, filter);
                    this._showDropdownList(index);
                },
                handlePaste: function (index, event) {
                    if (this.newFilter.inputValue && this.newFilter.inputValue.trim().length) return;

                    event.preventDefault();
                    var text;

                    if (event.clipboardData) {
                        text = event.clipboardData.getData('text/plain');
                    } else if (window.clipboardData) {
                        text = window.clipboardData.getData('Text');
                    }

                    if (!text) return;

                    text = text.replace(/\s+/g, ' | ');
                    this.filters.push({
                        active: false,
                        label: '域名',
                        value: text,
                        inputValue: undefined,
                        oldInputValue: undefined,
                        showBubble: false,
                        dropdown: {
                            showKey: false,
                            showValue: false,
                            list: [],
                            value: []
                        },
                        backup: {
                            label: '域名',
                            value: text,
                        },
                        isSpecial: true,
                        _key: Date.now(),
                    });
                    this.search();
                },
                handleClickInput: function (index, event) {
                    this.active = true;
                    this._showDropdownList(index);
                },
                handleSelectFilterType: function (index) {
                    var el = index === -1 ? this.$refs.newFilter : this.$refs.filter[index];
                    var filter = index === -1 ? this.newFilter : this.filters[index];
                    var match = filter.inputValue.match(/^(.*?)(\:\s*(.*))?$/);
                    var label = match && match[1] || '';
                    var value = match && match[3] || '';
                    var isSpecialLabel = !!_.find(this.filterTypes, function (filter) {
                        return filter.label === label;
                    });

                    if (!isSpecialLabel) {
                        filter.inputValue = filter.label + (match && match[2] || '');
                    } else {
                        if (label === filter.label) {
                            filter.inputValue = label + ': ' + value;
                            this.$nextTick(function () {
                                el.focus();
                                el.setSelectionRange(label.length + 2, filter.inputValue.length);
                            });
                        } else {
                            filter.inputValue = filter.label + ': ';
                            this.$nextTick(function () {
                                el.focus();
                                el.setSelectionRange(filter.inputValue.length, filter.inputValue.length);
                            });
                        }
                    }
                    this.handleInput(index);
                },
                handleSelectValue: function (index) {
                    var filter = index === -1 ? this.newFilter : this.filters[index];
                    var semiIndex = filter.inputValue.indexOf(':');
                    filter.inputValue = filter.inputValue.substring(0, semiIndex) + ': ' + filter.dropdown.value.join(' | ');

                    this.handleInput(index);
                },
                handleSelectValueClick: function (index, confirm) {
                    var filter = index === -1 ? this.newFilter : this.filters[index];
                    if (confirm) {
                        this.confirmFilter(index);
                    } else {
                        if (index === -1) {
                            filter.inputValue = '';
                            this.handleInput(index);
                        } else {
                            filter.label = filter.backup.label;
                            filter.value = filter.backup.value;
                            filter.active = false;
                        }
                    }
                },
                search: function () {
                    var searchFilters = {
                        projects: [],
                        host: [],
                        origin: [],
                        tag_keys: [],
                    };
                    var map = {
                        '所属项目': 'projects',
                        '标签': 'tag_keys',
                        '源站': 'origin',
                        '域名': 'host',
                    };

                    _.each(this.filters, function (filter) {
                        if (filter.isSpecial) {
                            searchFilters[map[filter.label]].push.apply(searchFilters[map[filter.label]], filter.value.split(/\s*\|\s*/g));
                        } else {
                            searchFilters.host.push(filter.label);
                        }
                    });

                    if (_.indexOf(searchFilters.projects, '全部项目') >= 0) {
                        delete searchFilters.projects;
                    } else {
                        searchFilters.projects = _.filter(
                            _.map(searchFilters.projects, function (projectName) {
                                return projectNameMap[projectName];
                            }),
                            function (projectId) { return typeof projectId !== undefined; }
                        );
                    }

                    _this.main(searchFilters, true);
                    tableStatus.searchFilters = this.filters;
                },
                _updateFilter: function (index, filter) {
                    filter.oldInputValue = filter.inputValue;
                    var match = filter.inputValue.match(/^(.*?)(\:\s*(.*))?$/);
                    var label = match && match[1] || '';
                    var value = match && match[3] || '';
                    filter.label = label;

                    if (filter.dropdown.showValue) {
                        filter.dropdown.value = value.trim() ? value.trim().split(/\s*\|\s*/g) : [];
                    }

                    // if (index === -1) {
                    //     this.newFilter = filter;
                    // } else {
                    //     this.filters.splice(index, 1, filter);
                    // }
                },
                _showDropdownList: function (index) {
                    var self = this;
                    if (index > 0) {
                        this.newFilter.dropdown.showKey = false;
                        this.newFilter.dropdown.showValue = false;
                    }
                    var activeFilterIndex = _.findIndex(this.filters, function (filter) { return filter.dropdown.showKey || filter.dropdown.showValue });
                    if (activeFilterIndex >= 0) {
                        var filter = this.filters[activeFilterIndex];
                        // filter.dropdown.showKey = false;
                        // filter.dropdown.showValue = false;
                        this._updateFilter(activeFilterIndex, filter);
                    }

                    this.$nextTick(function () {
                        var filter = index === -1 ? self.newFilter : self.filters[index];
                        var el = index === -1 ? self.$refs.newFilter : self.$refs.filter[index];
                        var cursorPos = el.selectionStart;
                        var semiIndex = filter.inputValue.indexOf(':');
                        var label = filter.inputValue.substring(0, semiIndex);
                        if (semiIndex < 0 || cursorPos <= semiIndex) {
                            filter.dropdown.showKey = true;
                            filter.dropdown.showValue = false;
                        } else {
                            var theFilter = _.find(self.filterTypes, function (filter) { return filter.label === label; });
                            filter.dropdown.showKey = false;
                            filter.dropdown.showValue = theFilter && theFilter.autocomplete;
                            filter.dropdown.list = theFilter && theFilter.list;
                        }
                        self._updateFilter(index, filter);
                    });
                },
            },
        });
    };

    var initTagApp = function () {
        tagApp = new Vue({
            el: '[_dn_cdn_access_tag]',
            components: {
                qcDialog: qcvue.QcDialog,
                qcTable: qcvue.QcTable,
                qcBubble: qcvue.QcBubble,
                searchableDropdown: qcvueExtra.searchableDropdown,
            },
            data: {
                showModifyDialog: false,
                showUpdatingDialog: false,

                showMultiTagsBubble: false,
                multiTagsBubbleData: null,

                accountTagKeys: [],
                accountTagMap: {},

                domains: [],
                existingTags: [],
                existingTagsCopy: [],
                existingTagsTableColumns: [
                    { label: '标签键', key: 'key', width: '110px' },
                    { label: '标签值', key: 'value', width: '340px' },
                    { label: '删除', key: 'delete' },
                ],
                newTags: [{ key: '', value: '' }],
                updatingDomains: [],

                showHelpDialog: false,
            },
            computed: {
                autoCompleteKeys: function () {
                    return _.difference(this.accountTagKeys, _.map(this.existingTags, 'key'));
                },
                multiTagsBubbleStyle: function () {
                    if (!this.showMultiTagsBubble || !this.multiTagsBubbleData) return {};
                    var root = $(this.$el);
                    var dialog = $(this.$el).find('[data-role="qc-dialog"]').offset();
                    var hoverTag = root.find('.tc-15-table-fixed-body tr').eq(this.multiTagsBubbleData.rowIndex).find('.tc-tag-txt span');
                    var hoverTagOffset = hoverTag.offset();

                    return {
                        width: '240px',
                        zIndex: 9999,
                        top: hoverTagOffset.top - dialog.top + hoverTag.outerHeight() + 10 + 'px',
                        // 12 triangle height
                        left: hoverTagOffset.left - dialog.left - 120 + 24 + 'px'
                        // 150 half width, 24 half tag text
                    };
                },
                updatingFailureCount: function () {
                    return _.filter(this.updatingDomains, function (task) { return !task.success }).length;
                }
            },
            created: function () {
                var self = this;
                ep.on("dialog:modifyTag", function (domains) {
                    if (!domains || !domains.length) return;

                    self.domains = domains;

                    // 拉取选择域名绑定的标签，以及该账号所有的标签键（for autocomplete）
                    Promise.all([self.fetchTagsByDomains(_.map(domains, 'domain')), self.fetTagKeys()]).then(function (ress) {
                        var tagsByDomainsRes = ress[0], tagKeysRes = ress[1];
                        if (tagsByDomainsRes.code !== 0) return tips.error(tagsByDomainsRes.message);

                        self.showModifyDialog = true;
                        var existingTags = [];
                        _.each(_.groupBy(tagsByDomainsRes.data.rows, 'tagKey'), function (tags, key) {
                            var tag = {
                                key: key,
                                delete: false,
                                modified: false,
                            };

                            // 统计不同的标签值出现的次数（因为域名同一个标签键绑定的并非同一个标签值）
                            var valuesCounter = {}, totalValues = 0;
                            _.each(tags, function (tag) {
                                if (!valuesCounter[tag.tagValue]) valuesCounter[tag.tagValue] = 0;
                                valuesCounter[tag.tagValue]++;
                                totalValues++;
                            });
                            // values 是所有标签值的计数
                            tag.values = _.map(valuesCounter, function (count, tagValue) { return { value: tagValue, count: count }; });
                            if (totalValues < self.domains.length) tag.values.push({ value: '未设置标签', count: self.domains.length - totalValues });
                            // value 是输入框的v-model
                            tag.value = tag.values.length === 1 ? tag.values[0].value : '';
                            existingTags.push(tag);
                        });

                        self.existingTags = existingTags;
                        self.existingTagsCopy = _.map(existingTags, function (tag) {
                            return _.clone(tag);
                        });

                        if (tagKeysRes.code !== 0) return tips.error(tagKeysRes.message);
                        self.accountTagKeys = tagKeysRes.data.rows;

                        // 对当前已绑定域名的标签 拉取其对应的标签值（for autocomplete）
                        if (self.existingTags.length === 0) return;
                        self.fetchTagValues(_.map(self.existingTags, 'key')).then(function (tagValuesRes) {
                            if (tagValuesRes.code !== 0) return tips.error(tagValuesRes.message);

                            var map = {};
                            _.each(tagValuesRes.data.rows, function (tag) {
                                if (!map[tag.tagKey]) map[tag.tagKey] = [];
                                if (map[tag.tagKey].indexOf(tag.tagValue) < 0) map[tag.tagKey].push(tag.tagValue);
                            });
                            _.each(map, function (value, key) {
                                self.$set(self.accountTagMap, key, value);
                            });
                        });
                    });
                });

                ep.on("dialog:showHelpDialog", function () {
                    self.showHelpDialog = true;
                });
            },
            methods: {
                // 请求
                fetTagKeys: function () {
                    return capiv3('GetTagKeys', {
                        v2: true,
                        serviceType: 'tag',
                        data: {
                            page: 1,
                            rp: 1000, // 单个用户最多1000个不同的key
                        }
                    });
                },
                fetchTagValues: function (keys) {
                    return capiv3('GetTagValues', {
                        v2: true,
                        serviceType: 'tag',
                        data: {
                            tagKeys: keys,
                            page: 1,
                            rp: 1000, // 一个key最多有1000个value
                        }
                    });
                },
                fetchTagsByDomains: function (domains) {
                    return capiv3('GetResourceTagsByResourceIds', {
                        v2: true,
                        serviceType: 'tag',
                        data: {
                            region: 'ap-guangzhou',
                            serviceType: 'cdn',
                            resourcePrefix: 'domain',
                            resourceIds: domains,
                            page: 1,
                            rp: 1000, // 一个资源最多50个不同的key
                        }
                    });
                },
                modifyDomainTags: function (domain, toDeleteTagKeys, toReplaceTagKeys) {
                    if (!domain) return Promise.resolve();

                    return capiv3('ModifyResourceTags', {
                        v2: true,
                        serviceType: 'tag',
                        data: {
                            resource: 'qcs::cdn:ap-guangzhou:uin/' + (CDN.userInfo.ownerUin) + ':domain/' + domain,
                            replaceTags: toReplaceTagKeys, // 修改的标签
                            deleteTags: toDeleteTagKeys,
                        },
                    });
                },
                // 逻辑
                getAutoCompleteTagValues: function (currentKey) {
                    return this.accountTagMap[currentKey] || [];
                },
                addNewTag: function () {
                    this.newTags.splice(this.newTags.length, 0, { key: '', value: '' });
                },
                deleteNewTag: function (index) {
                    this.newTags.splice(index, 1);
                },
                onChangeTagKey: _.debounce(function (index, key) {
                    var key = this.newTags[index].key;
                    // 未输入键或键对应的值已存在
                    if (!key || this.accountTagMap[key]) return;

                    var self = this;
                    this.fetchTagValues([key]).then(function (res) {
                        if (res.code !== 0) return;

                        self.$set(self.accountTagMap, key, _.map(res.data.rows, 'tagValue'));
                    });
                }, 1000),
                onSetTagKey: function (index) {
                    var key = this.newTags[index].key;
                    if (!key) return;

                    for (var i = 0; i < this.newTags.length; i++) {
                        if (this.newTags[i].key === key && i !== index) {
                            this.newTags.splice(index, 1, { key: '', value: '' });
                            var el = $(this.$refs.newTagValue[i].$el).find('input');
                            el.focus();
                            el[0].setSelectionRange(this.newTags[i].value.length, this.newTags[i].value.length);
                            break;
                        }
                    }
                },
                showBubble: function (show, data) {
                    this.showMultiTagsBubble = show;
                    this.multiTagsBubbleData = show ? data : null;
                },
                changeExistingTagValue: function (index) {
                    var tag = this.existingTagsCopy[index];
                    tag.modified = this.existingTags[index].value !== tag.value;
                    if (tag.modified) {
                        this.existingTagsCopy.splice(index, 1, tag);
                    }
                },
                clickModifyDialog: function (id) {
                    if (id === 'no') {
                        this.domains = [];
                        this.existingTags = [];
                        this.existingTagsCopy = [];
                        this.newTags = [{ key: '', value: '' }];
                        this.accountTagKeys = [];
                        this.accountTagMap = {};
                        this.showModifyDialog = false;
                        this.updatingDomains = [];
                        return;
                    }

                    var toDeleteTagKeys = [];
                    var toReplaceTagKeys = [];
                    _.each(this.existingTagsCopy, function (tag) {
                        if (tag.delete) toDeleteTagKeys.push({ tagKey: tag.key });
                        else if (tag.modified) toReplaceTagKeys.push({ tagKey: tag.key, tagValue: tag.value });
                    });
                    _.each(this.newTags, function (tag) {
                        if (tag.key) toReplaceTagKeys.push({ tagKey: tag.key, tagValue: tag.value });
                    });

                    this.showModifyDialog = false;
                    if (toReplaceTagKeys.length === 0 && toDeleteTagKeys.length === 0) return this.clickModifyDialog('no');

                    this.showUpdatingDialog = true;
                    var self = this;
                    function loop(index) {
                        self.modifyDomainTags(self.domains[index].domain, toDeleteTagKeys, toReplaceTagKeys).then(function (res) {
                            self.updatingDomains.push({
                                domain: self.domains[index].domain,
                                success: res.code === 0,
                                message: toReplaceTagKeys.length === 0 ? '删除标签' : '修改标签'
                            });
                            if (++index < self.domains.length) loop(index);
                        }).catch(function (err) {
                            var task = {
                                domain: self.domains[index].domain,
                                success: false,
                                message: toReplaceTagKeys.length === 0 ? '删除标签' : '修改标签',
                                errMessage: '失败！',
                            }
                            if (typeof err === 'object' && err.cgwCode && tagErrorMessage[err.cgwCode]) {
                                task.errMessage = tagErrorMessage[err.cgwCode];
                            }
                            self.updatingDomains.push(task);
                            if (++index < self.domains.length) loop(index);
                        });
                    }
                    loop(0);
                },
                clickUpdatingDialog: function () {
                    this.showUpdatingDialog = false;
                    this.clickModifyDialog('no');
                },
                getUpdatingProgress: function () {
                    return Math.min(100, this.updatingDomains.length / this.domains.length * 100) + '%';
                },
            }
        });
    };

    return {
        container: accessTemplate,
        render: function(isOversea, isManageBackToAccess, isOverseaCustomer) {
            oversea = isOversea || false;
            manageBackToAccess = isManageBackToAccess || false;
            overseaCustomer = isOverseaCustomer || false;
            hostData = [];
            if (!manageBackToAccess) {
                tableStatus = {
                    page: 0,
                    count: 0,
                    statusResult: [],
                    originResult: [],
                    typeResult: [],
                    projectResult: [],

                    searchFilters: false,
                };
            }

            ep = new eventproxy();
            _this.tmpl = initTmpl();
            _this.dialog = initDialog();
            b_domainTable = initBeeForDomainTable();
            b_dropdownList = initBeeForDropdownList();
            initContextMenu($(b_domainTable.$el));
            initEvent();
            initOversea();
            initSearchBar();
            initTagApp();
        },
        destroy: function() {
            tableStatus.page = temp_page;
            tagApp && tagApp.$destroy();
            tagApp = null;
        }
    }
});
