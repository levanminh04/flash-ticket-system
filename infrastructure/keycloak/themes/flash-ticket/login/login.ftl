<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Đăng Nhập - Flash Ticket</title>
    <link rel="stylesheet" href="${url.resourcesPath}/css/login.css">
</head>
<body>
<div class="login-container">
    <div class="login-card">
        <div class="logo">
            <h1>🎫 Flash Ticket</h1>
            <p>Hệ thống đặt vé sự kiện</p>
        </div>

        <#if message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
            <div class="alert alert-${message.type}">
                ${kcSanitize(message.summary)?no_esc}
            </div>
        </#if>

        <form id="kc-form-login" action="${url.loginAction}" method="post">
            <div class="form-group">
                <label for="username">Email</label>
                <input
                        id="username"
                        name="username"
                        type="text"
                        value="${(login.username!'')}"
                        placeholder="buyer@flash-ticket.vn"
                        autofocus
                        autocomplete="username"
                        required
                />
            </div>

            <div class="form-group">
                <label for="password">Mật khẩu</label>
                <input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        autocomplete="current-password"
                        required
                />
            </div>

            <#if realm.rememberMe && !usernameHidden??>
                <div class="form-checkbox">
                    <input
                            id="rememberMe"
                            name="rememberMe"
                            type="checkbox"
                            <#if login.rememberMe??>checked</#if>
                    />
                    <label for="rememberMe">Ghi nhớ đăng nhập</label>
                </div>
            </#if>

            <button type="submit" class="btn-primary">
                Đăng nhập
            </button>
        </form>

        <div class="login-footer">
            <#if realm.resetPasswordAllowed>
                <a href="${url.loginResetCredentialsUrl}">Quên mật khẩu?</a>
            </#if>
            <#if realm.registrationAllowed>
                <a href="${url.registrationUrl}">Đăng ký tài khoản mới</a>
            </#if>
        </div>
    </div>
</div>
</body>
</html>
