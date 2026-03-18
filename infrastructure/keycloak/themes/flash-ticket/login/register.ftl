<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Đăng Ký - Flash Ticket</title>
    <link rel="stylesheet" href="${url.resourcesPath}/css/login.css">
</head>
<body>
<div class="login-container">
    <div class="login-card">
        <div class="logo">
            <h1>Flash Ticket</h1>
            <p>Đăng ký tài khoản hệ thống</p>
        </div>

        <#if message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
            <div class="alert alert-${message.type}">
                ${kcSanitize(message.summary)?no_esc}
            </div>
        </#if>

        <form id="kc-register-form" action="${url.registrationAction}" method="post">
            <div class="form-row">
                <div class="form-group">
                    <label for="firstName">Họ</label>
                    <input id="firstName" name="firstName" type="text" value="${(register.formData.firstName!'')}" placeholder="Nguyễn" required autofocus />
                </div>
                <div class="form-group">
                    <label for="lastName">Tên</label>
                    <input id="lastName" name="lastName" type="text" value="${(register.formData.lastName!'')}" placeholder="Văn A" required />
                </div>
            </div>

            <div class="form-group">
                <label for="email">Email</label>
                <input id="email" name="email" type="email" value="${(register.formData.email!'')}" placeholder="buyer@flash-ticket.vn" required />
            </div>

            <div class="form-group">
                <label for="username">Tên đăng nhập</label>
                <input id="username" name="username" type="text" value="${(register.formData.username!'')}" placeholder="nguyenvana123" required />
            </div>

            <div class="form-group">
                <label for="password">Mật khẩu</label>
                <input id="password" name="password" type="password" placeholder="••••••••" required />
            </div>

            <div class="form-group">
                <label for="password-confirm">Xác nhận mật khẩu</label>
                <input id="password-confirm" name="password-confirm" type="password" placeholder="••••••••" required />
            </div>

            <button type="submit" class="btn-primary">
                Đăng ký
            </button>
        </form>

        <div class="social-login">
            <div class="social-separator">
                <span>Hoặc đăng ký bằng</span>
            </div>
            <div class="social-buttons">
                <#if social.providers??>
                    <#list social.providers as p>
                         <a href="${p.loginUrl}" id="social-${p.alias}" class="btn-social btn-${p.alias}">
                             ${p.displayName}
                         </a>
                    </#list>
                <#else>
                    <button type="button" class="btn-social btn-google">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                        Google
                    </button>
                    <button type="button" class="btn-social btn-facebook">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07" fill="#1877F2"/><path d="M16.67 15.54l.53-3.5h-3.32v-2.27c0-.95.47-1.88 1.96-1.88h1.51V4.92s-1.37-.24-2.68-.24c-2.73 0-4.54 1.68-4.54 4.7v2.73H7.08v3.5h3.04V24c2.66.42 5.4.42 8.02 0v-8.46h3.53z" fill="#fff"/></svg>
                        Facebook
                    </button>
                </#if>
            </div>
        </div>

        <div class="login-footer">
            <a href="${url.loginUrl}">Đã có tài khoản? Đăng nhập</a>
        </div>
    </div>
</div>
</body>
</html>
