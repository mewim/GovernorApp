import sys

encoding = sys.argv[1]
sys.stdin.reconfigure(encoding=encoding)

for line in sys.stdin:
    sys.stdout.write(line)
