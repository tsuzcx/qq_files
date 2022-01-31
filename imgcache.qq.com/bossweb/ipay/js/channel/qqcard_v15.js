/**********************
 * qqcard.js for PAY
 * @author leonlchen
 */

//验证码
function refreshVerifyImage(obj) {
    var _url = '//' + (location.protocol == "https:" ? 'ssl.' : '') + 'captcha.qq.com/getimage?aid=11000101&r=';
    //if (typeof obj.attr === 'function') {
    obj.attr('src', _url + Math.random());
    //} else {
    //obj.src = _url + Math.random();
    //}
}

(function () {
    /* WARNING 组件 */
    var WARNING = {
        // @param setting : object
        // {
        //		outter	: 	object		|	增加或清除.warning class的元素
        //		inner	: 	object		|	展示warning提示语的元素
        //		focus	: 	object		|	完成提示操作后将焦点移动到该元素上
        //		type 	: 	string 		|	展示警告(tips不为空的情况)(show)	隐藏警告(hide)
        //		tips	: 	string 		|	提示语(默认值)('')
        //		mode 	: 	string  	|   替换 (默认值)(replace)	追加 (before | after)
        //		callback: 	function	|	完成展示后的回调
        // }
        set: function (setting) {
            if (setting && setting.outter && setting.inner) {
                //配置默认值
                setting.type = setting.type || 'show';
                setting.tips = setting.tips || '';
                setting.mode = setting.mode || 'replace';

                //模式
                switch (setting.mode) {
                    case 'before' :
                        setting.inner.html(setting.tips + setting.inner.html());
                        break;
                    case 'after' :
                        setting.inner.html(setting.inner.html() + setting.tips);
                        break;
                    default :
                        setting.inner.html(setting.tips);
                        break;
                }

                //展示警告逻辑
                if (setting.tips !== '' && setting.type === 'show') {
                    setting.outter.addClass('warning');
                    setting.inner.show();
                } else {
                    setting.outter.removeClass('warning');
                    setting.inner.hide();
                }

                if (setting.focus) {
                    setting.focus.focus();
                }

                if (typeof setting.callback === 'function') {
                    return setting.callback();
                } else {
                    return true;
                }

            } else {
                return false;
            }
        }
    };

    /* qqcard逻辑控制 */
    var QQCARD = {
        //卡号cookie
        'memory': '',
        'lastquery_card': ''
    };

    //金额
    QQCARD.fee = function (amount) {
        var fee = (parseInt(amount, 10) * (IPAY.data.price)).toFixed(2);
        if (fee > 0) {
            var temp = fee.split(".");
            if (parseFloat(temp[0]) == fee) {
                fee = temp[0];
            }
        }
        $('[fee="fee"]').html((window.globalPrice && globalPrice.totalPrice && globalPrice.totalPrice[IPAY.amount]) || fee);

        return this;
    };

    //校验
    QQCARD._check_flag = function (type) {
        if (!type) {
            type = {'all': true};
        }

//		var _length = $('#target_uin_input').val().length,
//			_amount = parseInt($('#amount_input').val()),
        var password = QQCARD.cardPassword.val();

//		//uin
//		if (type.all) {
//			if (_length < 5) {
//				WARNING.set({
//					outter : $('#target_uin_input_field'),
//					inner : $('#target_uin_warning'),
//					tips : '<i class="icon-help"></i>请输入正确的QQ帐号'
//				});
//				return false;
//			} else {
//				WARNING.set({
//					outter : $('#target_uin_input_field'),
//					inner : $('#target_uin_warning')
//				});
//			}
//		}

//		//开通数量
//		if (type.amount || type.all) {
//			if (!_amount || _amount <= 0) {
//				WARNING.set({
//					outter : $("#amount_input_field"),
//					inner : $("#amount_warning"),
//					tips : '<i class="icon-help"></i>' + (IPAY.data.type === 'service' ? '请输入正确的时长' : '请输入正确的充值数额')
//				});
//				return false;
//			} else if (IPAY.data.code === '-qqpoint' && ~~_amount % 10 !== 0) {
//				WARNING.set({
//					outter : $("#amount_input_field"),
//					inner : $("#amount_warning"),
//					tips : '<i class="icon-help"></i>Q点充值应为10的整数倍'
//				});
//				return false;
//			} else {
//				WARNING.set({
//					outter : $('#amount_input_field'),
//					inner : $('#amount_warning')
//				});
//			}
//		}

        //开通数量
        var _amount=$("#qqcard_input_amount").val()
        if (!/^\d+$/.test(_amount) && _amount > 0) {
            WARNING.set({
                outter: $("#amount_input_field"),
                inner: $("#amount_warning"),
                tips: '<i class="icon-help"></i>' + (IPAY.data.type === 'service' ? '请输入正确的时长' : '请输入正确的充值数额')
            });

            return false
        }

        if (IPAY.checkForm() === false) return false;

        //大区

        //qq卡号
        if (type.cardNum || type.all) {
            if (QQCARD.cardNum.val().length != 9) {
                WARNING.set({
                    outter: $("#cardNum_warning"),
                    inner: $("#cardNum_error"),
                    tips: '<i class="icon-help"></i>请输入正确的QQ卡号'
                });
                return false;
            } else {
                WARNING.set({
                    outter: $('#cardNum_warning'),
                    inner: $('#cardNum_error')
                });
            }
        }

        //qq卡密
        if (type.cardPassword || type.all) {
            if (password.length != 12) {
                WARNING.set({
                    outter: $("#cardPassword_warning"),
                    inner: $("#cardPassword_error"),
                    tips: '<i class="icon-help"></i>请输入正确的QQ卡密码'
                });
                return false;
            } else {
                WARNING.set({
                    outter: $('#cardPassword_warning'),
                    inner: $('#cardPassword_error')
                });
            }
        }

        //验证码1
        if (type.extcode || type.all) {
            if (QQCARD.extcode.val().length < 4) {
                WARNING.set({
                    outter: $("#extcode_warning"),
                    inner: $("#extcode_error"),
                    tips: '<i class="icon-help"></i>请输入正确的验证码'
                });
                return false;
            } else {
                WARNING.set({
                    outter: $('#extcode_warning'),
                    inner: $('#extcode_error')
                });
            }
        }

        //验证码2 查询
        if (type.extcode_query) {
            if (QQCARD.extcode_query.val().length < 4) {
                WARNING.set({
                    outter: $("#extcode_query_warning"),
                    inner: $("#extcode_query_error"),
                    tips: '<i class="icon-help"></i>请输入正确的验证码'
                });
                return false;
            } else {
                WARNING.set({
                    outter: $('#extcode_query_warning'),
                    inner: $('#extcode_query_error')
                });
            }
        }

        return true;
    };

    //q卡input明文、cookie处理
    QQCARD.inputEvent = function () {
        //Q卡cookie读取设置和记录
        var _set_memory = function () {
            QQCARD.memory = LIB.cookie.get('qqcard' + IPAY.uin);
            if (QQCARD.memory) {
                QQCARD.cardNum.val(QQCARD.memory);
            }
        };
        var _record = function () {
            QQCARD.memory = QQCARD.cardNum.val();
            LIB.cookie.set('qqcard' + IPAY.uin, QQCARD.memory, {'time': 1000 * 3600 * 12});
        };

        //清除非数字输入
        var _int_require = function (obj) {
            if (!obj.val().match(/^[0-9]+$/)) {
                obj.val(obj.val().replace(/[^\d]/g, ''));
            }

            return obj.val();
        };
        //清除非数字或者是字母输入
        var _strnum_require = function (obj) {
            obj.val(obj.val().replace(/[\W]/g, ''));
            return obj.val();
        };

        //是否明文显示
        var _plain = true;

        //显示明文卡号
        var _to_show_num = function (e) {
            var val = _strnum_require(QQCARD.cardNum);
            var str = val.substring(0, 3) + ' ' + val.substring(3, 6) + ' ' + val.substring(6, 9);

            if (val) {
                /*QQCARD.showNum.html(str);
                 e.type == 'blur' ? QQCARD.showNum.parent().hide() : QQCARD.showNum.parent().show();
                 e.type == 'blur' && QQCARD.cardNum.val().length == 9 && _record();*/
            } else {
                QQCARD.showNum.html('').parent().hide();
                //卡号为空清空密码
                QQCARD.cardPassword.val('').keyup();
                QQCARD.showPsw.html('').parent().hide();
                QQCARD.showPsw_m.html('').parent().hide();
                WARNING.set({
                    outter: $('#cardPassword_warning'),
                    inner: $('#cardPassword_error')
                });
            }
        };

        //显示明文密码
        var _to_show_psw = function (e) {
            var val = _int_require(QQCARD.cardPassword);
            var str = val.substring(0, 4) + ' ' + val.substring(4, 8) + ' ' + val.substring(8, 12);
            var m_str = str.replace(/[0-9]/g, '●');

            /*if (val) {
             QQCARD.showPsw.html(str);
             QQCARD.showPsw_m.html(m_str);
             _plain ? QQCARD.showPsw.parent().show() : QQCARD.showPsw_m.parent().show();
             } else {
             QQCARD.showPsw.html('').parent().hide();
             QQCARD.showPsw_m.html('').parent().hide();
             }*/
        };

        //明文事件处理
        QQCARD.cardNum.bind('keyup blur focus', _to_show_num);
        QQCARD.cardPassword.bind('keyup blur focus', _to_show_psw);
        QQCARD.hide.click(function () {
            //隐藏
            _plain = false;
            QQCARD.hide.parent().hide();
            QQCARD.show.parent().show();
            QQCARD.cardPassword.focus();
        });
        QQCARD.show.click(function (e) {
            //明文显示
            _plain = true;
            QQCARD.hide.parent().show();
            QQCARD.show.parent().hide();
            QQCARD.cardPassword.focus();
        });

        return _set_memory();
    };

    //查询余额
    QQCARD.queryCard = function () {
        if (QQCARD._check_flag({
                'extcode_query': true
            })) {
            var url = "//pay.qq.com/cgi-bin/account/account_qqcard_query.cgi?func=QCardQueryBalance"
                + "&CardNum=" + QQCARD.cardNum.val()
                + "&CardPassword=" + QQCARD.cardPassword.val()
                + "&VerifyCode=" + $('#extcode_query').val()
                + "&outputjson=true";
            $.getJSON(url, function (data) {
                //清空验证码输入框
                QQCARD.extcode_query.val('');

                // 	0 成功   |   其他 失败
                if (data.resultcode != 0) {
                    //失败
                    switch (data.resultcode) {
                        case 10011 :
                            data.resultinfo = '验证码错误，请重新输入查询';
                            //刷新验证码
                            refreshVerifyImage($('#imgVerify_query'));
                            QQCARD.extcode_query.focus();
                            break;
                        case 10053 : //QQ卡账户不存在 || QQ卡号密码错误
                            //关闭浮层，外层显示提示
                            if (data.resultinfo === 'QQ卡账号密码错误') {
                                //QQ卡账号密码错误
                                WARNING.set({
                                    outter: $("#cardPassword_warning, #cardNum_warning"),
                                    inner: $("#cardPassword_error"),
                                    tips: '<i class="icon-help"></i>QQ卡账号密码错误',
                                    focus: QQCARD.cardNum,
                                    callback: function () {
                                        //关闭浮层
                                        $('[query_button="close"]').first().click();
                                    }
                                });
                            } else {
                                //QQ卡账户不存在
                                WARNING.set({
                                    outter: $("#cardNum_warning"),
                                    inner: $("#cardNum_error"),
                                    tips: '<i class="icon-help"></i>QQ卡账户不存在',
                                    focus: QQCARD.cardNum,
                                    callback: function () {
                                        //关闭浮层
                                        $('[query_button="close"]').first().click();
                                    }
                                });
                            }
                            break;
                        default :
                            //重写cgi返回错误信息，原信息有误
                            data.resultinfo = '系统繁忙，请稍后再试';
                            //刷新验证码
                            refreshVerifyImage($('#imgVerify_query'));
                            break;
                    }
                    WARNING.set({
                        outter: $("#extcode_query_warning"),
                        inner: $("#extcode_query_error"),
                        tips: '<i class="icon-help"></i>' + data.resultinfo
                    });
                } else {
                    //记录查询成功卡号
                    QQCARD.lastquery_card = data.resultinfo.CardNo;
                    //隐藏浮层验证码块
                    $('#query_input').hide();
                    //卡号
                    $('#query_num').html(data.resultinfo.CardNo);
                    //余额
                    $('#balance').html(data.resultinfo.Balance + 'Q币 （' + data.resultinfo.Balance * 10 + 'Q点）');
                    //有效期
                    $('#expire').html(data.resultinfo.Expire);
                    //成功
                    $('#query_succ').show();
                    $('#query_btn_div').hide();
                    $('#close_btn_div').show();
                }
            });
        }
    };

    //表单事件
    QQCARD.bindEvent = function () {

        /**************************** Q卡查询事件处理 ***********************/

            //外层“查询Q卡余额”文字按钮
        $('#queryCard').click(function () {
            if (QQCARD._check_flag({
                    'cardNum': true,
                    'cardPassword': true
                })) {
                //同一张卡不做查询入口
                if (!(QQCARD.cardNum.val() == QQCARD.lastquery_card)) {
                    //隐藏历史成功信息
                    $('#query_succ').hide();
                    //展示验证码块
                    $('#query_input').show();
                    $('#close_btn_div').hide();
                    $('#query_btn_div').show();
                }

                //展示浮层
                IPAY.alert('queryLayer', 400, IPAY.scene === 'pay' ? 250 : 200);

                //刷新浮层验证码和验证码输入框 并聚焦
                QQCARD.extcode_query.val('').keyup().focus();
                refreshVerifyImage($('#imgVerify_query'));
            }

            //解决ie6下因href属性打断验证码图片加载的问题
            return false;
        });

        //浮层关闭按钮
        $('[query_button="close"]').click(function () {
            //清空历史错误信息
            $('#extcode_query_error').html('').hide();

            //刷新外层验证码
            refreshVerifyImage($('#imgVerify'));

            //关闭浮层
            $('#queryLayer').hide();
            $("#mybg").remove();

            //解决ie6下因href属性打断验证码图片加载的问题
            return false;
        });

        //浮层内查询按钮
        $('#query').click(QQCARD.queryCard);

        //验证码input失去焦点校验
        QQCARD.extcode_query.bind('blur keyup', function (e) {
            if (e.type == 'keyup') {
                if (e.keyCode == '13') {
                    $('#query').click();
                }
                WARNING.set({
                    outter: $("#extcode_query_warning"),
                    inner: $("#extcode_query_error")
                });
            } else {
                QQCARD._check_flag({'extcode_query': true});
            }
        });

        //esc和回车监听，点击后关闭浮层
        var temp_fun = function (e) {
            //浮层显现时点击esc则关闭    ||    查询成功后回车，关闭浮层
            if ($('#queryLayer').css('display') != 'none' && (e.keyCode == '27' || (e.keyCode == '13' && $('#query_succ').css('display') != 'none'))) {
                $('[query_button="close"]').first().click();
            }
        };

        $(document).bind('keyup', temp_fun);

        /*************************** Q卡查询事件 结束 ***********************/

        /********** 充值开通表单input失去焦点时校验 **********/

            //卡号输入框
        QQCARD.cardNum.bind('blur keyup', function (e) {
            if (e.type == 'keyup') {
                //输入时清空历史错误提示
                WARNING.set({
                    outter: $("#cardNum_warning"),
                    inner: $("#cardNum_error"),
                    callback: function () {
                        $('#callback_warning').hide();
                    }
                });
            } else {
                QQCARD._check_flag({'cardNum': true});
            }
        });
        //卡密输入框
        QQCARD.cardPassword.bind('blur keyup', function (e) {
            if (e.type == 'keyup') {
                //输入时清空历史错误提示
                WARNING.set({
                    outter: $("#cardPassword_warning"),
                    inner: $("#cardPassword_error"),
                    callback: function () {
                        $('#callback_warning').hide();
                    }
                });
            } else {
                QQCARD._check_flag({'cardPassword': true});
            }
        });
        //提交充值开通的验证码输入框
        QQCARD.extcode.bind('blur keyup', function (e) {
            if (e.type == 'keyup') {
                //验证码框内回车提交，如果不同意条款提交按钮会隐藏，不能做提交处理
                if (e.keyCode == '13' && $('#btnSubmit_div').css('display') != 'none') {
                    $('#btnSubmit').click();
                }
                //输入时清空历史错误提示
                WARNING.set({
                    outter: $("#extcode_warning"),
                    inner: $("#extcode_error"),
                    callback: function () {
                        $('#callback_warning').hide();
                    }
                });
            } else {
                QQCARD._check_flag({'extcode': true});
            }
        });
        /********** 充值开通表单input失去焦点校验 结束 **********/

            //提交
        $('#btnSubmit').click(function () {
            if (QQCARD._check_flag({'all': true})) {
                var _opts = {
                    action: function (url) {
                        //防止回车重复提交
                        IPAY.lockForm(true);
                        QQCARD.extcode.blur();
                        $('#btnSubmit_div').hide().siblings('#btnSubmit_disable_div').show().children('#submit_loading').show();

                        //提交至iframe
                        $('#callback_iframe').attr('src', url);
                    },
                    data: {
                        pay_way: 6,
                        pay_num: QQCARD.cardNum.val(),
                        password: QQCARD.cardPassword.val(),
                        VerifyCode: QQCARD.extcode.val(),
                        PatchTime: Math.random()
                    }
                };
                IPAY.submit(_opts);
            }
        });

        //金额回调
        IPAY.onAmountChange = function (amount) {
            QQCARD.fee(amount);
        };

        //业务切换回调
        IPAY.onCodeChange = function (code) {
            QQCARD.fee(IPAY.amount);
        };

        //条款回调
        IPAY.onAgreeTermChange = function (checked) {
            if (checked) {
                $('#btnSubmit_disable_div').hide().siblings('#btnSubmit_div').show();
            } else {
                $('#btnSubmit_div').hide().siblings('#btnSubmit_disable_div').show().children('#submit_loading').hide();
            }
        };

        //转渠道
        IPAY.onTransChannelCallback = function () {
            $('#callback_iframe').width('580').height('350').show();
            $('#back_div').width('580').height('390');
            $('#ts_title').html('提示');
            $('#ts_title').parent().parent().show();
            IPAY.alert('back_div', 580, 390);
            $('#back_div')[0].style.border = '';
            $('#back_div')[0].style.background = '';
        };

        //转渠道关闭回调
        IPAY.alertHide = function () {
            //清除遮罩层
            $("#mybg").remove();
            //iframe隐藏
            $('#back_div').hide();

            //清空验证码
            QQCARD.extcode.val('');
            //刷新验证码
            refreshVerifyImage($('#imgVerify'));

            //解锁 提交按钮恢复
            IPAY.lockForm(false);
            $('#btnSubmit_disable_div').hide().siblings('#btnSubmit_div').show();
        };

        //充值开通回调
        IPAY.onPayCallback = function (data) {
            //刷新验证码
            refreshVerifyImage($('#imgVerify'));
            var res = {};
            if (!~~data.result) {
                //成功
                res.result = {
                    'result_code': 0,						//状态码 0 成功 || 1 失败
                    'service_name': data.service_name,		//服务名
                    'amount': data.pre_open_month,			//实际开通月数
                    'target_uin': data.user_num,			//承载号码
                    'uin': IPAY.uin || data.pay_uin		//付款号码
                };
                res.callback = function () {
                    //清空验证码
                    QQCARD.extcode.val('');

                    //Q卡可能已经消费，清空上次查询记录
                    QQCARD.lastquery_card = '';

                    //锁定，恢复提交按钮
                    IPAY.lockForm(false);
                    $('#btnSubmit_disable_div').hide().siblings('#btnSubmit_div').show();
                }
            } else {
                //失败
                res.result = {
                    'result_code': 1,
                    'errmsg': data.result_info				//失败信息
                };
                res.callback = function () {
                    //清空验证码
                    QQCARD.extcode.val('');

                    //解锁，恢复提交按钮
                    IPAY.lockForm(false);
                    $('#btnSubmit_disable_div').hide().siblings('#btnSubmit_div').show();

                    //定位错误
                    switch (~~data.error_code) {
                        case 20002 :
                        case 20021 :
                            //提交验证码错误，重新聚焦到验证码输入框
                            WARNING.set({
                                outter: $("#extcode_warning"),
                                inner: $("#extcode_error"),
                                tips: '<i class="icon-help"></i>验证码错误，请重试',
                                focus: QQCARD.extcode
                            });
                            break;
                        case 20017 :
                            //Q卡号密码错误或卡不存在
                            if (data.error_code_list === '20017--1-1001007') {
                                //QQ卡账号密码错误
                                WARNING.set({
                                    outter: $("#cardPassword_warning, #cardNum_warning"),
                                    inner: $("#cardPassword_error"),
                                    tips: '<i class="icon-help"></i>QQ卡账号密码错误',
                                    focus: QQCARD.cardNum,
                                    callback: function () {
                                        QQCARD.cardNum.select();
                                    }
                                });
                            } else {
                                //QQ卡账户不存在
                                WARNING.set({
                                    outter: $("#cardNum_warning"),
                                    inner: $("#cardNum_error"),
                                    tips: '<i class="icon-help"></i>非腾讯Q币卡，请联系卖家咨询',
                                    focus: QQCARD.cardNum,
                                    callback: function () {
                                        QQCARD.cardNum.select();
                                    }
                                });
                            }
                            break;
                        //case 20025 :
                        //	//余额不足
                        //	QQCARD.cardNum.focus().select();
                        //   break;
                        case 20009:
                            //操作过于频繁被限制操作
                            if (data.error_code_list === '20009-35600-170015' || data.error_code_list === '20009-35600-170054') {
                                WARNING.set({
                                    outter: $("#callback_warning"),
                                    inner: $("#callback_error"),
                                    tips: '<i class="icon-help"></i>由于您操作过于频繁暂时锁定，请24小时后再尝试操作。',
                                    callback: function () {
                                        $("#callback_warning").show();
                                    }
                                });
                            } else {
                                //20009-65593-65593 已经用手机开通了直接展示错误
                                WARNING.set({
                                    outter: $("#callback_warning"),
                                    inner: $("#callback_error"),
                                    tips: '<i class="icon-help"></i>' + data.result_info,
                                    callback: function () {
                                        $("#callback_warning").show();
                                    }
                                });
                            }

                            break;
                        default :
                            //系统繁忙，比如Q卡余额为0这种情况下提交会出现
                            //修改tips文本，显示父元素，并加上waring样式
                            WARNING.set({
                                outter: $("#callback_warning"),
                                inner: $("#callback_error"),
                                tips: '<i class="icon-help"></i>' + data.result_info,
                                callback: function () {
                                    $("#callback_warning").show();
                                }
                            });
                            break;
                    }
                }
            }

            return res;
        };

        //更换渠道去除qqcard特性
        IPAY.onBeforeChannelChange = function () {

            //GM needs
            if (IPAY.data.type === 'recharge') {
                $('#qqcard_input_field').hide();
                $('#amount_input_field').show();
            }

            //去除esc，回车监听
            $(document).unbind('keyup', temp_fun);

            //删除浮层
            $('#queryLayer').remove();

            //释放内存
            QQCARD = WARNING = null;

        };

        return this;
    };

    //页面渲染回调
    QQCARD.render = function () {
        //加载模板
        $("#main_template").html(LIB.template.cache['qqcard_html']);
        $('body').append(LIB.template.cache['extend_querycard_html']);

        //缓存dom元素
        var dom = {
            'cardNum': $('#cardNum'),						//卡号
            'cardPassword': $('#cardPassword'),			//卡密
            'showPsw': $('#showPsw'),          			//明文显示密码区域
            'showPsw_m': $('#showPsw_m'),       			//密文显示密码区域
            'showNum': $('#showNum'),                 		//清晰版卡号区域
            'show': $('#show'),                 		 	//明文显示文字按钮
            'hide': $('#hide'),                			//隐藏明文文字按钮
            'extcode': $('#extcode'),						//充值开通验证码
            'extcode_query': $('#extcode_query')	        //余额查询验证码
        };

        $.each(dom, function (key, val) {
            QQCARD[key] = val;
        });

        //模板渲染
        QQCARD.fee(IPAY.amount).bindEvent().inputEvent();

        //刷新首次验证码
        refreshVerifyImage($('#imgVerify'));

        //条款勾选检测
        IPAY.onAgreeTermChange(IPAY.agree_term);

        //QdQb充值
        if (IPAY.data.type == 'recharge') {
            $('#pay_fee').hide();
            $('button[__ext]').textWithWrapper('立即充值');
            /*.siblings('#recharge_fee').show();*/
            $('#amount_input_field').hide();
            $('#qqcard_input_amount').val(IPAY.amount);
            $('#qqcard_input_field').show();
            $('#qqcard_input_amount').keyup(function () {
                $('#qqcard_input_amount_error').hide();

                if (!/^\d+$/g.test(this.value)) {
                    $('#qqcard_input_amount_error').show();
                } else {
                    $('#amount_input').val(this.value);
                    $('#amount_value').html(this.value);
                    IPAY.updateAmount(this.value, true, true);
                }
            }).blur(function () {
                if (!/^\d+$/g.test(this.value)) {
                    $('#qqcard_input_amount_error').show();
                } else {
                    IPAY.updateAmount(this.value, true, true);
                }
            });
        }

    };

    //初始化，读取缓存或发起请求
    QQCARD.init = function (render) {
        //查看缓存
        if (!LIB.template.cache['qqcard_html'] || !LIB.template.cache['extend_querycard_html']) {
            LIB.template.cache['qqcard_html'] = '<div class="control-group " id="cardNum_warning">    <label class="control-label" for="cardNum">QQ卡号：</label>    <div class="controls">        <input type="text" id="cardNum" maxlength="9" />        <div class="help-number"><span id="showNum"></span></div>        <div class="help-block" style="display:none" id="cardNum_error">请输入正确的QQ卡号</div>    </div></div><div class="control-group " id="cardPassword_warning">    <label class="control-label" for="cardPassword">QQ卡密码：</label>    <div class="controls">        <input type="text" id="cardPassword" maxlength="12" />        <span class="help-inline">&nbsp;&nbsp;<a href="javascript:void(0);" id="queryCard">查询QQ卡余额</a></span>        <div class="help-number" style="display:none"><span id="showPsw"></span>&nbsp;&nbsp;<a href="javascript:void(0);" id="hide">隐藏</a></div>        <div class="help-number" style="display:none"><span id="showPsw_m"></span>&nbsp;&nbsp;<a href="javascript:void(0);" id="show">明文显示</a></div>        <div class="help-block" style="display:none" id="cardPassword_error">请输入正确的QQ卡密码</div>    </div></div><div class="control-group " id="qqcard_input_field" style="display:none;"><label class="control-label" class="control-label" >充值数量：</label><div class="controls">        <input type="text" id="qqcard_input_amount" class="input-min" maxlength="7" />&nbsp;&nbsp;<span id="amount_unit">Q币</span><span class="help-inline">（1Q币 = 10Q点）</span>        <div class="help-block" style="display:none" id="qqcard_input_amount_error"><i class="icon-help"></i>请输入正确的充值数量</div>    </div></div><!--==文字==--><div class="control-group " id="pay_fee">    <label class="control-label">应付金额：</label>    <div class="controls">        <h5 class="title-primary"><em fee="fee"></em>Q币<span class="help-inline">（1Q币 = 10Q点）</span></h5>    </div></div><div class="control-group " id="recharge_fee" style="display:none">    <label class="control-label">应付金额：</label>    <div class="controls">        <h5 class="title-primary"><em fee="fee"></em>元</h5>    </div></div><div class="control-group" id="extcode_warning">    <label class="control-label">验证码：</label>    <div class="controls">        <input id="extcode" class="input-small" type="text" style="ime-mode:disabled;">         <a href="javascript:void(0);" onclick=\'refreshVerifyImage($("#imgVerify"));return false;\' ><img id="imgVerify" class="verify" style="width:130px;height:53px;vertical-align:top;"></a>        &nbsp;        <a href="javascript:void(0);" onclick=\'refreshVerifyImage($("#imgVerify"));return false;\'>换一张</a>        <div class="help-block" style="display:none" id="extcode_error">请输入正确的验证码</div>    </div></div><div class="control-group" id="callback_warning" style="display:none">    <label class="control-label"></label>    <div class="controls">        <div class="help-block" id="callback_error"></div>    </div></div><div class="form-actions" id="btnSubmit_div">    <button type="button" data-type="submit_button" id="btnSubmit" class="btn-primary" __ext><span>立即开通</span></button></div><div class="form-actions" id="btnSubmit_disable_div" style="display:none">    <button type="button" data-type="submit_button" class="btn-primary disabled" __ext><span>立即开通</span></button>    <span class="font_12" id="submit_loading"><img src="//imgcache.qq.com/bossweb/minipay/images/load.gif">交易正在处理，请稍后...</span></div><div class="float" style="display:none;width:392px;height:390px;" id="back_div">    <div class="float-header">        <h3><a href="javascript:void(0)" class="close" onclick="IPAY.alertHide();return false;">×</a><span id="ts_title">提示</span></h3>     </div>    <div class="float-content cf">        <iframe src="about:blank" style="display:none" id="callback_iframe" frameborder="no" scrolling="no"></iframe>    </div></div><div id="phonecard_wenxin" style="margin-top:50px;" class="geniality-tip">    <p class="g-title">        <i class="icon-warn-g"></i>温馨提示    </p>    <p class="g-cont">        1.我司发行QQ卡号为9位数字，密码为12位数字，没有英文字母，若您购买的QQ卡含有英文字母或位数不够，<em>请联系第三方卖家处理</em>；    </p>    <p class="g-cont">        2.购买QQ卡可在附近的网吧或报刊亭、电脑城等地购买，请在购买时留意QQ卡位数；    </p>    <p class="g-cont">        3.QQ卡支持分多次充值，但请在有效期内使用，如：30元面值QQ卡，可先充值10元，再充20元；    </p>    <p class="g-cont">        4.请在QQ卡有效期内使用，若超过有效期则无法使用，请勿刮坏QQ卡，若刮坏可联系卖家处理；    </p>    <p class="g-cont">        5.通过电信积分兑换的Q币卡请<a href="//card.e10001.com/qq.aspx" target="_blank">登录电信对应的入口</a>进行操作；    </p>    <p class="g-cont">        6.QQ卡充值是立即到帐，若未到帐请<a href="//my.pay.qq.com/account/index.shtml?aid=pay.ipay.header.acct&ADTAG=pay.ipay.header.acct#qqcard" target="_blank">点击这里</a>查看充值情况；    </p>    <p class="g-cont">        7.更多信息了解，<a href="//kf.qq.com/faq/120322vI7BNr140403j2IziE.html" target="_blank">请点击链接</a>。    </p></div>';
            LIB.template.cache['extend_querycard_html'] = '<div class="float min" id="queryLayer" style="display:none">    <div class="float-header">        <h3><a href="javascript:void(0);" class="close" query_button="close">&times;</a>查询QQ卡余额</h3>    </div>    <div class="float-content cf">        <!--验证码表单-->        <div class="form-float" id="query_input">            <div class="control-group " id="extcode_query_warning"><!--错误 warning -->                <label class="control-label">请输入验证码</label>                <div class="controls">                    <input class="input-medium " type="text" id="extcode_query">                    <div class="help-text">                        <a href="javascript:void(0);" onclick="refreshVerifyImage($(\'#imgVerify_query\'));return false;"><img id="imgVerify_query" class="verify" style="width:130px;height:53px;vertical-align:top;"/></a>&nbsp;&nbsp;<a href="javascript:void(0);" onclick="refreshVerifyImage($(\'#imgVerify_query\'));return false;">换一张</a></p>                    </div>                    <div class="help-block" id="extcode_query_error" style="color: #E96440">                    </div>                </div>            </div>        </div>        <!--查询结果-->        <div class="form-float" style="display:none" id="query_succ">            <div class="control-group">                <label class="control-label">卡号：</label>                <div class="controls">                    <div class="control-word">                        <p id="query_num"></p>                    </div>                </div>            </div>            <div class="control-group ">                <label class="control-label">余额：</label>                <div class="controls">                    <div class="control-word">                        <p id="balance"></p>                    </div>                </div>            </div>            <div class="control-group ">                <label class="control-label">有效期：</label>                <div class="controls">                    <div class="control-word">                        <p id="expire"></p>                    </div>                </div>            </div>        </div>    </div>    <div class="float-footer">        <div class="form-actions" id="query_btn_div">            <button id="query" type="button" class="btn-primary-small"><span>查 询</span></button>        </div>        <div class="form-actions" style="display:none" id="close_btn_div">            <button type="button" class="btn-primary-small" query_button="close"><span>确 定</span></button>        </div>    </div></div>';
        }

        return render();
    }(QQCARD.render);
})();