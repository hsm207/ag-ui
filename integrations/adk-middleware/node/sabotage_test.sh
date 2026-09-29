#!/bin/bash
# Break the type name in the EventTranslator
sed -i "s/type: AgUiEventType.TEXT_MESSAGE_CONTENT/type: 'BROKEN_TEXT_MESSAGE_CONTENT' as any/g" src/EventTranslator.ts

# Run tests
npm run test > test_output.log 2>&1

if grep -q "FAIL" test_output.log; then
  echo "Sabotage Test Passed: Tests caught the broken dialect!"
else
  echo "Sabotage Test Failed: Tests did NOT catch the broken dialect."
fi

# Revert
sed -i "s/type: 'BROKEN_TEXT_MESSAGE_CONTENT' as any/type: AgUiEventType.TEXT_MESSAGE_CONTENT/g" src/EventTranslator.ts
npm run test > /dev/null
