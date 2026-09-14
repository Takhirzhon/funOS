# Included from every location in nginx.conf. A separate file because of how
# `add_header` inherits: a location that sets ANY add_header of its own drops
# every header from the enclosing server block. Defining these once at server
# level would silently leave them off /health, /assets/ and /index.html — the
# three locations that all need their own Cache-Control.
#
# No Content-Security-Policy yet. React and react-rnd set inline `style=`
# attributes, xp.css has none of its own, but a CSP has to be tested against the
# real bundle before it ships — add it here when it has been.
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
