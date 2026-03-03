const fs = require('fs');
const path = 'D:\\Escritorio\\Antigravity\\Palma Real\\palma-real-app\\src\\pages\\Cobranzas.jsx';

let content = fs.readFileSync(path, 'utf8');

// The structural problem is likely an extra '};' or unclosed brace around line 311
// Let's perform a full "template-based" structural repair

const headerIdx = content.indexOf('const Cobranzas = () => {');
if (headerIdx === -1) { console.error('Cobranzas header not found'); process.exit(1); }

const endIdx = content.lastIndexOf('export default Cobranzas;');
if (endIdx === -1) { console.error('Export default not found'); process.exit(1); }

// Extract the component body
let body = content.substring(headerIdx, endIdx);

// Look for the return statement
const returnIdx = body.lastIndexOf('return (');
if (returnIdx === -1) { console.error('Return statement not found'); process.exit(1); }

// Find the last actual closing brace of the component (should be just before export default)
// The current content has:
// 675:     </div >
// 676: );
// 677: }; <- This is likely the one closing the component
// 678: 
// 679: export default Cobranzas;

// Let's try to find if there's an early '};' before the return
const bodyBeforeReturn = body.substring(0, returnIdx);
// Count braces to see if we closed the component early
let openBraces = 0;
for (let i = 0; i < bodyBeforeReturn.length; i++) {
    if (bodyBeforeReturn[i] === '{') openBraces++;
    if (bodyBeforeReturn[i] === '}') openBraces--;
}

console.log('Open braces before return:', openBraces);

if (openBraces === 0) {
    // Component was closed early!
    // Find the last '};' in bodyBeforeReturn and remove it
    const lastCloseIdx = bodyBeforeReturn.lastIndexOf('};');
    if (lastCloseIdx !== -1) {
        console.log('Found early closure at index', lastCloseIdx);
        const newBody = bodyBeforeReturn.substring(0, lastCloseIdx) + '  ' + bodyBeforeReturn.substring(lastCloseIdx + 2) + body.substring(returnIdx);
        fs.writeFileSync(path, content.substring(0, headerIdx) + newBody + content.substring(endIdx), 'utf8');
        console.log('Repaired early closure.');
    }
} else {
    console.log('No obvious early closure found in bodyBeforeReturn.');
}
