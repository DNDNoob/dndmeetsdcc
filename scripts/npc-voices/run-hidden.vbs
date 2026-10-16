' Starts run.cmd with no window, so NPC voices runs quietly in the background.
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run """" & here & "\run.cmd""", 0, False
