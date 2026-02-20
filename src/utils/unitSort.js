/**
 * Utility to sort unit objects naturally based on floor and number.
 * Order: PB-A, PB-B, ..., 1-A, 1-B, ..., 2-A, ..., 3-D
 */
export const sortUnits = (units) => {
    if (!units || !Array.isArray(units)) return [];

    const floorWeights = {
        'PB': 0,
        'SS': -1, // Sótano (just in case)
        'SC': -2  // Semisótano (just in case)
    };

    return [...units].sort((a, b) => {
        // Compare floors first
        const floorA = a.floor || '';
        const floorB = b.floor || '';

        const weightA = floorWeights[floorA] !== undefined ? floorWeights[floorA] : parseInt(floorA) || 99;
        const weightB = floorWeights[floorB] !== undefined ? floorWeights[floorB] : parseInt(floorB) || 99;

        if (weightA !== weightB) {
            return weightA - weightB;
        }

        // If floor is the same, compare number (e.g. "PB-A" vs "PB-B" or "1-A" vs "1-B")
        const numA = a.number || '';
        const numB = b.number || '';

        // LocalCompare is good for "PB-A" vs "PB-B"
        return numA.localeCompare(numB, undefined, { numeric: true, sensitivity: 'base' });
    });
};
