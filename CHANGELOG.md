## v6.0.0 Breaking changes
- `routes`: Removed `token` from `validations` export

## v5.0.0 Breaking changes
- `calculations`: Removed `getRadian` export
- `data`: Removed `setField` export, use [`lodash.set(object, path, value)`](https://lodash.com/docs/4.17.15#set) instead
- `data`: Removed `gatherArrays` export
- `data`: Removed `roundFloat` export, use [`lodash.round(number, precision)`](https://lodash.com/docs/4.17.15#round) instead
- `data`: Removed `formatQuery` export
- `formatters`: Remove `capitalizeFirst` export, use [`lodash.upperFirst(string)`](https://lodash.com/docs/4.17.15#upperFirst) instead
