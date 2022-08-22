// 开通服务页面
/**
 */
define(function(require, exports, module) {
    var $ = require("cdn/$");
    var dao = require("cdn/data/dao");
    var capiv3 = require("cdn/data/dao_cloud_api_v3").requestPromise;
    var openTemplate = require("../../templates/open.html.js");
    var noAuthemplate = require("../../templates/noAuthority.html.js");
    var tmpl = require("cdn/lib/tmpl");
    var dialog = require("cdn/dialog");
    var router = require("cdn/router");
    var pageManager = require('cdn/pageManager');
    var tips = require('cdn/tips');

    var _this = {};
    var regData = {
        pay_type: "",
        type: "",
        name: "",
        idcardType: "",
        idcard: "",
        service_type: ""
    };

    function open() {
        $(".step").addClass("actived");

        $(".guide-link").show();
        $("[data-cdn-event=selectpay]").click(function(e) {
            e.preventDefault();
            $("[data-cdn-event=selectpay]").removeClass("checked");
            $(this).addClass("checked");
            var paytype = $("[data-cdn-event=selectpay].checked").data("cdn-paytype");
            if (paytype == "flux") {
                $("[data-cdn-payplate=flux]").show();
                $("[data-cdn-payplate=bandwidth]").hide();
            } else {
                $("[data-cdn-payplate=flux]").hide();
                $("[data-cdn-payplate=bandwidth]").show();
            }
        });

        $('[_dn_cdn_action="agreement"]').change(function(e) {
            var target = $(this);
            if (target.prop("checked") == true) {
                $("[data-cdn-event='openbtn']").removeClass("disabled");
            } else {
                $("[data-cdn-event=openbtn]").addClass("disabled");
            }
        });

        $("[data-cdn-event=openbtn]").click(function(e) {
            var target = $(this);
            /*
             * 用户点击确认开通，开通成功弹提示框“您已经成功开通腾讯云CDN服务！”，开通失败弹提示框“开通腾讯云CDN服务失败，请稍后重试” 成功后直接跳转到“接入管理首页”（图4）
             */
            e.preventDefault();
            if (target.hasClass("disabled")) {
                return;
            }

            var paytype = $("[data-cdn-event=selectpay].checked").data("cdn-paytype");
            regData.pay_type = paytype;

            // CDN回源COS需要从平台那里拉一个鉴权token，因此在用户注册前，CDN要自己保存一份
            capiv3('GetCdnToken', {
                v2:true,
                serviceType: "sts"
            }).then(function(res) {
                if (res.code === 0) {
                  regData.session_token = res.data.credentials.sessionToken;
                  regData.tmp_secret_id = res.data.credentials.tmpSecretId;
                  regData.tmp_secret_key = res.data.credentials.tmpSecretKey;
                  dao.openReg({
                      data: regData,
                      success: {
                          "0": function(res) {
                              CDN.base.area = res.data.area;
                              var pop = dialog.create(tmpl.parse(_this.tmpl.pop1, {
                                  area: CDN.base.area
                              }), 480, "", {
                                  "title": "成功开通",
                                  "isMaskClickHide": false,
                                  "class": "dialog_layer_v2 success-cdn",
                                  "button": {
                                      "确认": function() {
                                          dialog.hide();
                                          var returnUrl = location.search.match(/return_url=([^&]+)/);
                                          if (returnUrl && returnUrl[1]) {
                                              returnUrl = decodeURIComponent(returnUrl[1]);
                                              if (/^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/.test(returnUrl))
                                                  return window.open(returnUrl, '_self');;
                                          }

                                          nmc.refreshMenu("cdn",
                                          function() {
                                              window.open("/cdn/access", "_self");
                                          });
                                      }
                                  },
                                  "defaultCancelBtn": false
                              });
                          },
                          "default": function(rs) {
                              if (rs.code == 9123) {
                                  nmc.refreshMenu("cdn",
                                  function() {
                                      window.open("/cdn/access", "_self");
                                  });
                              }
                              else {
                                  var pop = dialog.create(_this.tmpl.pop2, 480, null, {
                                      "title": "开通CDN",
                                      "isMaskClickHide": false,
                                      "class": "dialog_layer_v2 failed-cdn",
                                      "button": {
                                          "确认": function() {
                                              dialog.hide();
                                          }
                                      }
                                  });
                              }
                          }
                      }
                  });
                }
            }).catch(function (e) {
                tips.error(e.message || "");
                defer.reject(e);
            });
        });

        if (CDN.base.area == 1) {
            //绑定计算器的计算事件
            $(".js-pay-caculator").on('click',  function() {
                window.open('https://' + CDN.buyDomain + '/calculator/cdn');
            });
        }
        else {
            //绑定计算器的计算事件
            $(".js-pay-caculator").hide();
        }

    }
    function reIdentify(data) {
        $("[data-cdn-event=reIdentify]").show().click(function() {
            var _html, _stepBar;
            _html = tmpl.parse(_this.tmpl.open1, data);
            if (CDN.base.area == 1) {
                _stepBar = tmpl.parse(_this.tmpl.stepBar, data);
            }
            else {
                _stepBar = tmpl.parse(_this.tmpl.stepBar_inter, data);
            }
            _html = _stepBar + _html;
            _this.$e.find(".domain-guide").html(_html);
            $("[data-event=go_auth]").click(function() {
                window.open("/developer?to=auth");
            });
        });
    }

    /**
             *
             */
    return {
        container: openTemplate,
        containerNoAuth: noAuthemplate,
        render: function() {
            _this.tmpl = {
                stepBar: $("[data-cdn-tmpl=stepBar]").html(),
                stepBar_inter: $("[data-cdn-tmpl=stepBar_inter]").html(),
                open1: $("[data-cdn-tmpl=open1]").html(),
                open2: $("[data-cdn-tmpl=open2]").html(),
                verify: $("[data-cdn-tmpl=verify]").html(),
                pop1: $("[data-cdn-tmpl=openpop1]").html(),
                pop2: $("[data-cdn-tmpl=openpop2]").html()
            };
            _this.$e = $(".main-wrap");
            dao.get_user_area({
                success: function(res) {
                    CDN.base.area = res.data || 1;
                    dao.getUserStatus({
                        data: {},
                        success: function(data) {
                            data = data || {};
                            var _html, _stepBar;
                            if (CDN.base.area == 1) {
                                _stepBar = tmpl.parse(_this.tmpl.stepBar, data);
                            }
                            else {
                                _stepBar = tmpl.parse(_this.tmpl.stepBar_inter, data);
                            }
                            $(_stepBar).replaceAll(_this.$e.find("[data-cdnname=stepBar-replace]"));
                            if (data.code === 1002) {
                                _html = tmpl.parse(_this.tmpl.open1, data);
                                $(_html).replaceAll(_this.$e.find("[data-cdnname=replace]"));
                                $("[data-event=go_auth]").click(function() {
                                    window.open("/developer?to=auth");
                                });
                            } else if (data.code === 1001) {
                                _html = tmpl.parse(_this.tmpl.verify, {
                                    area: CDN.base.area
                                });
                                $(_html).replaceAll(_this.$e.find("[data-cdnname=replace]"));
                            } else if (data.code === 0) {
                                _html = tmpl.parse(_this.tmpl.open2, {
                                    data: data.data,
                                    area: CDN.base.area
                                });
                                $(_html).replaceAll(_this.$e.find("[data-cdnname=replace]"));
                                if (CDN.base.area == 1) {
                                    $("[_dn_cdn_next]").click(function(e) {
                                        var regExp = /^\d{17}[\dxX]$/;
                                        var certificateNum = $.trim($('[_dn_cdn_certificate_number]').val());
                                        if ($('.btn-group button').not(".weak").length == 0) {
                                            tips.error("请选择服务内容");
                                            return;
                                        }
                                        if (data.data.authDetail.type == 1) {
                                            if (!$.trim($('[_dn_cdn_name]').val())) {
                                                $('[_dn_cdn_name]').parent().addClass("is-error");
                                                return;
                                            }
                                            if (!certificateNum || !regExp.test(certificateNum)) {
                                                $('[_dn_cdn_certificate_number]').parent().addClass("is-error");
                                                return;
                                            }
                                            regData.contact = $('[_dn_cdn_name]').val();
                                            regData.authenticateType = $('[_dn_cdn_certificate_type]').val();
                                            regData.orgCode = $('[_dn_cdn_certificate_number]').val();
                                        }
                                        regData.phoneNumber = data.data.userDetail.phoneNumber;
                                        regData.type = data.data.authDetail.type;
                                        regData.name = data.data.authDetail.name;
                                        regData.idcardType = data.data.authDetail.idcardType;
                                        regData.idcard = data.data.authDetail.idcard;
                                        regData.service_type = $('.btn-group button').not(".weak").prop("value");

                                        $('[_dn_cdn_step2]').hide();
                                        $('[_dn_cdn_step3]').show();
                                        open();
                                    });

                                    $('[_dn_cdn_pre]').click(function(e) {
                                        $('[_dn_cdn_step2]').show();
                                        $('[_dn_cdn_step3]').hide();
                                        $(".step").removeClass("actived");
                                    });

                                    $('.btn-group button').click(function(e) {
                                        $('.btn-group button').addClass("weak");
                                        $(this).removeClass("weak");
                                    });
                                }
                                else {
                                    regData.phoneNumber = 0;
                                    regData.type = 0;
                                    regData.name = 0;
                                    regData.idcardType = 0;
                                    regData.idcard = 0;
                                    regData.service_type = 0;
                                    $('[_dn_cdn_step2]').hide();
                                    $('[_dn_cdn_step3]').show();
                                    $('[_dn_cdn_pre]').hide();
                                    open();
                                }
                            } else {
                                _html = tmpl.parse(_this.tmpl.verify, {
                                    area: CDN.base.area
                                });
                                $(_html).replaceAll(_this.$e.find("[data-cdnname=replace]"));
                                $('.domain-guide').find('.tc-15-msg').html('您的资质尚未通过审核，请重新提交资料完成认证。');
                                $('.domain-guide').find('.tit').html('您的资质审核没有通过，请重新审核！');
                                reIdentify(data);
                            }

                        }
                    });
                }
            })
        },
        renderNoAuth: function() {
            $('[_dn_cdn_action="function"]').hide();
            $('[_dn_cdn_action="service"]').show();
        }
    }
});