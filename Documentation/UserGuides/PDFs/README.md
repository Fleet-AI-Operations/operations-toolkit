# User Guide PDFs

Professional PDF versions of the Operations Tools user guides for easy distribution to team members.

## 📄 Available PDFs

| File | Role | Size | Description |
|------|------|------|-------------|
| `USER_GUIDE.pdf` | USER | ~350KB | Basic features: Time tracking, links, profile |
| `QA_GUIDE.pdf` | QA | ~616KB | USER features + QA tools: records, similarity, analysis |
| `CORE_GUIDE.pdf` | CORE | ~651KB | USER + QA + CORE tools: scoring, review, assignments |
| `FLEET_GUIDE.pdf` | FLEET | ~654KB | USER + QA + CORE + FLEET: ingestion, management, analytics |
| `INDEX.pdf` | All | ~483KB | Navigation guide for all role-specific guides |

## 🎯 Usage

### Distributing to Users

1. **Email Distribution**: Attach the appropriate PDF based on user role
2. **Onboarding Packets**: Include in new hire materials
3. **Training Sessions**: Use as reference during training
4. **Internal Wiki**: Upload to company knowledge base

### Role-Based Distribution

- **New Users** → Send `USER_GUIDE.pdf`
- **QA Team Members** → Send `QA_GUIDE.pdf` (includes USER features)
- **Core Reviewers** → Send `CORE_GUIDE.pdf` (includes USER + QA features)
- **Fleet Managers** → Send `FLEET_GUIDE.pdf` (includes all features)
- **All Roles** → Send `INDEX.pdf` for navigation overview

## 🔄 Regenerating PDFs

To regenerate PDFs after updating markdown guides:

```bash
npm run guides:pdf
```

Or manually:

```bash
node scripts/generate-guide-pdfs.mjs
```

## 📝 PDF Features

- **Professional Styling**: Clean, readable layout with branded colors
- **Page Numbers**: Automatic page numbering in footer
- **Table of Contents**: Markdown headings create PDF bookmarks
- **Print-Friendly**: Optimized for both screen reading and printing
- **Hyperlinks**: All internal and external links are clickable

## 🎨 Styling

PDFs use the following design:
- **Primary Color**: #0070f3 (Operations Tools blue)
- **Font**: System fonts for maximum compatibility
- **Page Size**: A4 (210mm × 297mm)
- **Margins**: 25mm top/bottom, 20mm left/right

## 📋 Version Control

PDFs are generated from the markdown source files. Always:

1. Update the markdown guides first
2. Regenerate PDFs using `npm run guides:pdf`
3. Commit both markdown and PDF changes together
4. Keep markdown and PDF versions in sync

## ⚠️ Important Notes

- PDFs are generated from markdown files - never edit PDFs directly
- File sizes may vary slightly based on content length
- PDFs include all sections from the markdown guides
- Links within PDFs are clickable and functional
- Bonus windows removed from USER, QA, and CORE guides (FLEET only)

## 🔗 Related Documentation

- [Markdown Source Files](../) - Original markdown guides
- [USER_GUIDES_SUMMARY.md](../USER_GUIDES_SUMMARY.md) - Overview of all guides
- [Documentation Index](../../INDEX.md) - Main documentation hub

---

**Last Generated**: February 2026
**Generator Script**: `scripts/generate-guide-pdfs.mjs`
**Total Guides**: 5 PDFs
**Total Size**: ~2.7MB
