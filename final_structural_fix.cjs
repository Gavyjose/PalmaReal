const fs = require('fs');
const path = 'D:\\Escritorio\\Antigravity\\Palma Real\\palma-real-app\\src\\pages\\Cobranzas.jsx';

let content = fs.readFileSync(path, 'utf8');

// The structural error is at line 307: '};' closing the component too early
// and line 311: 'return (' starting outside the function.

const badPart = `    return { bs: totalBs, usd: totalUsd };
};

const { bs: totalCollectedBs, usd: totalCollectedUsd } = getMonthTotals();

return (`;

const goodPart = `        return { bs: totalBs, usd: totalUsd };
    };

    const { bs: totalCollectedBs, usd: totalCollectedUsd } = getMonthTotals();

    return (`;

if (content.indexOf(badPart) !== -1) {
    fs.writeFileSync(path, content.replace(badPart, goodPart), 'utf8');
    console.log('Successfully fixed structural redundant closure.');
} else {
    // Try a more flexible search if exact match fails
    const regex = /return\s*{\s*bs:\s*totalBs,\s*usd:\s*totalUsd\s*}\s*;\s*}\s*;\s*\s*const\s*{\s*bs:\s*totalCollectedBs,\s*usd:\s*totalCollectedUsd\s*}\s*=\s*getMonthTotals\(\)\s*;\s*\s*return\s*\(/;
    if (regex.test(content)) {
        fs.writeFileSync(path, content.replace(regex, goodPart), 'utf8');
        console.log('Successfully fixed structural redundant closure via regex.');
    } else {
        console.error('Could not find the problematic structural part.');
        // Last resort: find the specific lines and replace them
        const lines = content.split('\n');
        let fixed = false;
        for (let i = 0; i < lines.length - 10; i++) {
            if (lines[i].includes('return { bs: totalBs, usd: totalUsd };') &&
                lines[i + 1].trim() === '};' &&
                lines[i + 3].includes('const { bs: totalCollectedBs')) {
                lines[i + 1] = '    };';
                fixed = true;
                break;
            }
        }
        if (fixed) {
            fs.writeFileSync(path, lines.join('\n'), 'utf8');
            console.log('Successfully fixed structural redundant closure via line search.');
        } else {
            console.error('CRITICAL: Manual line search failed.');
        }
    }
}
