; Script de Inno Setup para MIKIT v1.0
[Setup]
AppName=MIKIT
AppVersion=1.0
AppPublisher=Pablo
DefaultDirName={autopf}\MIKIT
DefaultGroupName=MIKIT
UninstallDisplayIcon={app}\MIKIT-Desktop.exe
OutputDir=c:\Users\pablo\OneDrive\Desktop\MIKIT Desarrollo\installer
OutputBaseFilename=Instalar_MIKIT_v1.0
SetupIconFile=c:\Users\pablo\OneDrive\Desktop\MIKIT Desarrollo\icon.ico
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin

[Files]
Source: "c:\Users\pablo\OneDrive\Desktop\MIKIT Desarrollo\dist\MIKIT-Desktop.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\MIKIT"; Filename: "{app}\MIKIT-Desktop.exe"
Name: "{autodesktop}\MIKIT"; Filename: "{app}\MIKIT-Desktop.exe"

[Run]
Filename: "{app}\MIKIT-Desktop.exe"; Description: "Lanzar MIKIT despues de instalar"; Flags: nowait postinstall skipifsilent
