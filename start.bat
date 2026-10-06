@echo off
title Chatling Ephemeral Chat Server
color 0A
echo =======================================================
echo   Chatling Ephemeral 1-to-1 Real-Time Chat Server
echo =======================================================
echo.

set NODE_PATH="C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs\node.exe"

if exist %NODE_PATH% (
    %NODE_PATH% server.js
) else (
    node server.js
)

pause
