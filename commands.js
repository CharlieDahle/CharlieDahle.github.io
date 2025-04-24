// Command implementations
const Commands = {
    help() {
        TerminalOutput.addLine('Available Commands:');
        TerminalOutput.addLine('- help: Show this help menu');
        TerminalOutput.addLine('- clear: Clear the terminal screen');
        TerminalOutput.addLine('- resume: Display resume (download link coming soon)');
        TerminalOutput.addLine('- lang: Change or check language');
        TerminalOutput.addLine('- playground: List available games/activities');
        TerminalOutput.addLine('');
        TerminalOutput.addLine('About Me:');
        TerminalOutput.addLine('This site is a project of me, Charlie! I\'m junior dev who likes cute websites, music, and sandwiches');
    },
    
    resume(args) {
        const isLongFormat = args.includes('long');
        
        TerminalOutput.addLine('Charlie\'s Resume');
        TerminalOutput.addLine('-------------------');
        TerminalOutput.addLine('Work Experience:');
        TerminalOutput.addLine('Junior Developer');
        
        if (isLongFormat) {
            TerminalOutput.addLine('');
            TerminalOutput.addLine('Detailed Resume:');
            TerminalOutput.addLine('More details coming soon...');
        }
        
        TerminalOutput.addLine('');
        TerminalOutput.addLine('(Download link coming soon)');
    },
    
    lang(args) {
        if (args.length === 0) {
            TerminalOutput.addLine(`Current language: ${LanguageManager.currentLanguage}`);
            return;
        }
        
        const newLang = args[0].toLowerCase();
        if (LanguageManager.setLanguage(newLang)) {
            TerminalOutput.addLine(`Language set to: ${newLang}`);
        } else {
            TerminalOutput.addLine('Invalid language. Use "english" or "french".');
        }
    },

    clear() {
        TerminalOutput.clear();
        TerminalOutput.addLine(LanguageManager.translate('welcome'));
        TerminalOutput.addLine('Type "help" to see available commands');
      },
    
    playground(args) {
        if (args.length === 0) {
          TerminalOutput.addLine('Available Playground Activities:');
          TerminalOutput.addLine('- drums');
          TerminalOutput.addLine('');
          TerminalOutput.addLine('Use "playground <activity>" to start');
          return;
        }
        
        const activity = args[0].toLowerCase();
        if (activity === 'drums') {
          TerminalOutput.addLine('Opening Drum Machine...');
          
          // Load the drum machine in one of two ways:
          
          // Option 1: Load in a new window/tab
          window.open('/drums/drums.html', '_blank');
          
          // Option 2: Load in the current window
          // window.location.href = '/drums.html';
          
          // Option 3: Load in an iframe within the terminal (if you want to keep the terminal context)
          // const iframe = document.createElement('iframe');
          // iframe.src = '/drums.html';
          // iframe.style.width = '100%';
          // iframe.style.height = '500px';
          // iframe.style.border = 'none';
          // document.getElementById('output').appendChild(iframe);
        } else {
          TerminalOutput.addLine(`Unknown playground activity: ${activity}`);
        }
      }
};