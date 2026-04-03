import subprocess
result = subprocess.run(['python', '--version'], capture_output=True, text=True)
print(result.stdout, result.stderr)
