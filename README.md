# about

this is a **firefox** browser extension that helps you auto refresh STARS course index pages, and alerts you if it finds an index you want.

![NTU Snipe icon](src/snipe128.png)

# how to use

1. navigate to the index change page (https://wish.wis.ntu.edu.sg/pls/webexe/AUS_STARS_MENU.menu_option) on STARS

2. click the extension icon.

3. enter the indices that you want, in descending order of preference. space separated. type carefully, i was lazy to code input validation.

4. click start. allow notifications if prompted.

5. you can let the extension popup close, but **do not close the tab.** (you have to inspect the extension for now because i'm still migrating to the alarms api.)

6. once an index is found you will get a system notification.

# contributing

feel free to use any part of this code elsewhere, but please link back here.

uses manifest v3 so you could maybe port it to chrome. i'm not going to though because i'm spreading propaganda.

you can send PRs but i might not address them during the semester.