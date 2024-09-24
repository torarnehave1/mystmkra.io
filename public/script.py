import sys

# Get command-line arguments
data = sys.argv[1]

# Append data to text file (create the file if it doesn't exist)
with open('output.txt', 'a') as f:
    f.write(data + '\n')