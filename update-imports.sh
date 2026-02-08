#!/bin/bash

# Script to update import paths from monolithic app to turborepo packages

echo "Updating import paths in apps..."

# Function to update imports in a directory
update_imports() {
  local dir=$1
  echo "Processing $dir..."

  # Update @/lib/supabase imports
  find "$dir" -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
    -e "s|from '@/lib/supabase/server'|from '@repo/auth/server'|g" \
    -e "s|from '@/lib/supabase/client'|from '@repo/auth/client'|g" \
    -e "s|from \"@/lib/supabase/server\"|from \"@repo/auth/server\"|g" \
    -e "s|from \"@/lib/supabase/client\"|from \"@repo/auth/client\"|g" \
    {} \;

  # Update @/lib/prisma imports
  find "$dir" -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
    -e "s|from '@/lib/prisma'|from '@repo/database'|g" \
    -e "s|from \"@/lib/prisma\"|from \"@repo/database\"|g" \
    {} \;

  # Update @/lib/ai imports
  find "$dir" -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
    -e "s|from '@/lib/ai'|from '@repo/core/ai'|g" \
    -e "s|from \"@/lib/ai\"|from \"@repo/core/ai\"|g" \
    {} \;

  # Update @/lib/ingestion imports
  find "$dir" -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
    -e "s|from '@/lib/ingestion'|from '@repo/core/ingestion'|g" \
    -e "s|from \"@/lib/ingestion\"|from \"@repo/core/ingestion\"|g" \
    {} \;

  # Update @/lib/evaluation imports
  find "$dir" -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
    -e "s|from '@/lib/evaluation'|from '@repo/core/evaluation'|g" \
    -e "s|from \"@/lib/evaluation\"|from \"@repo/core/evaluation\"|g" \
    {} \;

  # Update @/lib/analytics imports
  find "$dir" -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
    -e "s|from '@/lib/analytics'|from '@repo/core/analytics'|g" \
    -e "s|from \"@/lib/analytics\"|from \"@repo/core/analytics\"|g" \
    {} \;

  # Update @/lib/similarity imports
  find "$dir" -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
    -e "s|from '@/lib/similarity'|from '@repo/core/similarity'|g" \
    -e "s|from \"@/lib/similarity\"|from \"@repo/core/similarity\"|g" \
    {} \;

  # Update @/lib/audit imports
  find "$dir" -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
    -e "s|from '@/lib/audit'|from '@repo/core/audit'|g" \
    -e "s|from \"@/lib/audit\"|from \"@repo/core/audit\"|g" \
    {} \;

  # Update @/lib/datetime imports
  find "$dir" -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
    -e "s|from '@/lib/datetime'|from '@repo/core/utils/datetime'|g" \
    -e "s|from \"@/lib/datetime\"|from \"@repo/core/utils/datetime\"|g" \
    {} \;

  # Update @/lib/constants imports
  find "$dir" -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
    -e "s|from '@/lib/constants'|from '@repo/core/utils/constants'|g" \
    -e "s|from \"@/lib/constants\"|from \"@repo/core/utils/constants\"|g" \
    {} \;

  echo "Completed $dir"
}

# Update all apps
for app in apps/admin apps/user apps/qa apps/core apps/fleet; do
  if [ -d "$app" ]; then
    update_imports "$app"
  fi
done

echo "Import update complete!"
