// Implementation A: Mathematical Formula (Arithmetic Progression)
// Complexity: 
// Time Complexity: O(1) - The calculation involves a constant number of arithmetic operations regardless of n.
// Space Complexity: O(1) - No additional space is used proportional to n.
function sum_to_n_a(n: number): number {
	return (n * (n + 1)) / 2;
}

// Implementation B: Iterative Loop
// Complexity:
// Time Complexity: O(n) - The loop runs n times.
// Space Complexity: O(1) - Only a single variable `sum` is used for storage.
function sum_to_n_b(n: number): number {
	let sum = 0;
	for (let i = 1; i <= n; i++) {
		sum += i;
	}
	return sum;
}

// Implementation C: Recursive Approach
// Complexity:
// Time Complexity: O(n) - The function calls itself n times.
// Space Complexity: O(n) - Each recursive call adds a frame to the call stack.
function sum_to_n_c(n: number): number {
	if (n <= 1) return n;
	return n + sum_to_n_c(n - 1);
}
