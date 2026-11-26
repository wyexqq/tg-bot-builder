const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('📦 Создаю Setup.exe...');

try {
  const nsis = require('makensis');

  const nsiScript = `
!include "MUI2.nsh"

Name "TG Bot Builder"
OutFile "$\{OUTDIR}\\TG Bot Builder Setup 1.0.0.exe"
InstallDir "$PROGRAMFILES\\TG Bot Builder"
InstallDirRegKey HKCU "Software\\TG Bot Builder" ""

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_LANGUAGE "Russian"

Section "Установить"
  SetOutPath "$INSTDIR"
  File /r "$\{SRCDIR}\\*.*"

  CreateDirectory "$SMPROGRAMS\\TG Bot Builder"
  CreateShortCut "$SMPROGRAMS\\TG Bot Builder\\TG Bot Builder.lnk" "$INSTDIR\\TG Bot Builder.exe"
  CreateShortCut "$DESKTOP\\TG Bot Builder.lnk" "$INSTDIR\\TG Bot Builder.exe"

  WriteRegStr HKCU "Software\\TG Bot Builder" "" "$INSTDIR"
SectionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\\TG Bot Builder\\TG Bot Builder.lnk"
  Delete "$DESKTOP\\TG Bot Builder.lnk"
  RMDir "$SMPROGRAMS\\TG Bot Builder"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\\TG Bot Builder"
SectionEnd
  `;

  fs.writeFileSync('installer.nsi', nsiScript);

  execSync('makensis /DSRCDIR=dist\\\\win-unpacked /DOUTDIR=dist installer.nsi', { stdio: 'inherit' });

  console.log('✅ Setup.exe создан в dist/');
  console.log('📂 Файлы для раздачи:');
  console.log('   - dist/TG Bot Builder Setup 1.0.0.exe (установщик)');
  console.log('   - dist/win-unpacked/ (портативная версия)');

  fs.unlinkSync('installer.nsi');

} catch (err) {
  console.error('❌ Ошибка:', err.message);
  console.log('\nАльтернатива: используй портативную версию из dist/win-unpacked/');
  process.exit(1);
}
