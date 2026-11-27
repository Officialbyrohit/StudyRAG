import fitz  # PyMuPDF
from pathlib import Path

SAMPLE_DIR = Path(__file__).resolve().parent
PDF_PATH = SAMPLE_DIR / "CS210_Lecture4_Sorting.pdf"
TXT_PATH = SAMPLE_DIR / "CS210_Lecture4_Sorting.txt"

pages_data = [
    (
        "CS210: Algorithms · Lecture 4 — Page 1",
        """Introduction to Divide-and-Conquer Sorting
Quicksort is an efficient, comparison-based, in-place divide-and-conquer sorting algorithm.
Unlike merge sort, which divides the array by index without inspecting values, quicksort partitions the array around a chosen pivot value.
The three steps of divide-and-conquer in quicksort are:
1. Divide: Partition the array A[p..r] into two sub-arrays A[p..q-1] and A[q+1..r] such that every element in A[p..q-1] is less than or equal to A[q], and every element in A[q+1..r] is greater than or equal to A[q].
2. Conquer: Recursively sort the two sub-arrays with quicksort.
3. Combine: Because the sub-arrays are already sorted in place, no work is required to combine them.
"""
    ),
    (
        "CS210: Algorithms · Lecture 4 — Page 2",
        """Partitioning Schemes
The core of quicksort is the partition step. The two most common partitioning schemes are:
1. Lomuto Partitioning: Selects the last element as pivot. Iterates through the array with two pointers. Performs roughly twice as many swaps as Hoare's, but is easier to analyze.
2. Hoare Partitioning: Uses two pointers starting from opposite ends and moving toward each other. Performs fewer swaps on average.
The running time of the partition step itself is Theta(n), or linear time, because every element is compared to the pivot exactly once.
"""
    ),
    (
        "CS210: Algorithms · Lecture 4 — Page 3",
        """Quicksort Recurrence & Time Complexity
The running time of quicksort depends strictly on whether the partitioning is balanced.
In the best-case scenario, the partition step divides the problem into two equal halves of size n/2.
The best-case recurrence relation is:
T(n) = 2T(n/2) + Theta(n).
Applying the Master Theorem (Case 2), this yields an optimal running time of T(n) = O(n log n).

In the worst-case scenario, one partition contains 0 elements and the other contains n - 1 elements.
This occurs when the array is already sorted (or reverse sorted) and the boundary element is chosen as pivot without randomization.
The worst-case recurrence is:
T(n) = T(n-1) + Theta(n) = O(n^2).
"""
    ),
    (
        "CS210: Algorithms · Lecture 4 — Page 4",
        """Pivot Selection & Balanced Partitions
Even an unbalanced partition such as a 9-to-1 ratio produces T(n) <= T(9n/10) + T(n/10) + cn, which still solves to O(n log n).
To guard against the worst case O(n^2) running time, practical implementations use:
1. Randomized pivot selection: Choosing a uniformly random element as pivot guarantees expected O(n log n) running time regardless of input ordering.
2. Median-of-three pivot selection: Selecting the median of the first, middle, and last elements avoids quadratic performance on sorted arrays.
Auxiliary space complexity: Quicksort is an in-place algorithm requiring only O(log n) auxiliary stack space for recursion.
"""
    ),
    (
        "CS210: Algorithms · Lecture 4 — Page 5",
        """Comparison With Other Sorting & Search Algorithms
1. Merge Sort: Time complexity is O(n log n) in all cases (best, average, worst). However, it requires O(n) auxiliary space for arrays.
2. Heapsort: Runs in O(n log n) worst-case time and sorts in place, but has higher constant factors. Building a max-heap of n elements takes O(n) linear time.
3. Insertion Sort: Average and worst-case time complexity is O(n^2), but best-case on an already sorted list is O(n).
4. Lower Bound: Any comparison-based sorting algorithm requires Omega(n log n) comparisons in the worst case.
5. Binary Search: Runs in O(log n) time on a sorted array with recurrence T(n) = T(n/2) + O(1).
6. Binary Search Tree (BST): A balanced BST with n nodes has height O(log n), but an unbalanced tree degrades to O(n).
"""
    )
]

def make_sample_files():
    doc = fitz.open()
    full_text = []
    for title, content in pages_data:
        page = doc.new_page()
        text_block = f"{title}\n\n{content}"
        full_text.append(text_block)
        page.insert_text((50, 70), text_block, fontsize=12)

    doc.save(str(PDF_PATH))
    doc.close()

    with open(TXT_PATH, "w", encoding="utf-8") as f:
        f.write("\n\n" + "="*50 + "\n\n".join(full_text))

    print(f"Sample PDF created at: {PDF_PATH}")
    print(f"Sample TXT created at: {TXT_PATH}")

if __name__ == "__main__":
    make_sample_files()
