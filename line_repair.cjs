const fs = require('fs');
const path = 'D:\\Escritorio\\Antigravity\\Palma Real\\palma-real-app\\src\\pages\\Cobranzas.jsx';

let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

let found = false;
for (let i = 0; i < lines.length - 10; i++) {
    // Look for the getMonthTotals return and its closing brace
    if (lines[i].includes('return { bs: totalBs, usd: totalUsd };') &&
        lines[i + 1].trim() === '};') {

        console.log(`Found problematic closure at line ${i + 2}`);
        // Remove the '};' at i+1
        lines[i + 1] = '    };'; // Indent it to show it's closing getMonthTotals, not the component
        found = true;
        break;
    }
}

if (found) {
    fs.writeFileSync(path, lines.join('\n'), 'utf8');
    console.log('Successfully fixed structural redundant closure via line-by-line repair.');
} else {
    console.error('CRITICAL: Could not find the structural pattern to fix.');
}
