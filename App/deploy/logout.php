<?php
// Destroys the shared PHP session (see index.php/lib.php's carshow_authenticated
// flag) and sends the browser to the club's main site — used by the hamburger
// menu's "Logout" item (LIVE mode only, see App/src/app.js's buildHeaderMenu()).
session_start();
session_unset();
session_destroy();
header('Location: https://www.etccwebsite.com/content.aspx?page_id=0&club_id=313652');
exit;
