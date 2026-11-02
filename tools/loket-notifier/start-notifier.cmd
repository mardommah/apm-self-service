@echo off
rem Isi dua baris ini, lalu taruh shortcut file ini di folder shell:startup.
set NOTIFIER_SERVER=http://192.168.1.127:3886
set NOTIFIER_KEY=isi-sama-dengan-NOTIFIER_KEY-di-server
cd /d "%~dp0"
start "Loket notifier" /min loket-notifier.exe
