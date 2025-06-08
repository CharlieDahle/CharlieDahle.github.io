// Terminal main script
document.addEventListener('DOMContentLoaded', () => {
    // Initialize output
    TerminalOutput.init('output');
    
    // Get input element
    const inputElement = document.getElementById('command-input');
    
    // Welcome message
    TerminalOutput.addLine(LanguageManager.translate('welcome'));
    TerminalOutput.addLine('Type "help" to see available commands');
    
    // Handle command input
    inputElement.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            const fullCommand = inputElement.value.trim();
            
            // Clear input
            inputElement.value = '';
            
            // Parse command and arguments
            const [command, ...args] = fullCommand.toLowerCase().split(' ');
            
            // Add input to output
            TerminalOutput.addLine(`> ${fullCommand}`);
            
            // Execute command
            if (Commands[command]) {
                Commands[command](args);
            } else if (command !== '') {
                TerminalOutput.addLine(LanguageManager.translate('unrecognized'));
            }
        }
    });
});