#!/bin/bash

# Fix imports to use correct package exports

echo "Fixing import paths to use correct exports..."

# Update datetime imports - import from @repo/core (re-exported by index)
find apps -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e "s|from '@repo/core/utils/datetime'|from '@repo/core'|g" \
  -e "s|from \"@repo/core/utils/datetime\"|from \"@repo/core\"|g" \
  {} \;

# Update constants imports - import from @repo/core (re-exported by index)
find apps -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e "s|from '@repo/core/utils/constants'|from '@repo/core'|g" \
  -e "s|from \"@repo/core/utils/constants\"|from \"@repo/core\"|g" \
  {} \;

# Update bug-reports imports - import from @repo/core (re-exported by index)
find apps -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e "s|from '@repo/core/utils/bug-reports'|from '@repo/core'|g" \
  -e "s|from \"@repo/core/utils/bug-reports\"|from \"@repo/core\"|g" \
  {} \;

# Update embedding-utils imports
find apps -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e "s|from '@repo/core/utils/embedding-utils'|from '@repo/core'|g" \
  -e "s|from \"@repo/core/utils/embedding-utils\"|from \"@repo/core\"|g" \
  {} \;

# Update errorIds imports
find apps -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e "s|from '@repo/core/utils/errorIds'|from '@repo/core'|g" \
  -e "s|from \"@repo/core/utils/errorIds\"|from \"@repo/core\"|g" \
  {} \;

echo "Import paths fixed!"
