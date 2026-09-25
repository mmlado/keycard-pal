source 'https://rubygems.org'

# You may use http://rbenv.org/ or https://rvm.io/ to install and use this version
ruby ">= 3.1.0"

# Exclude problematic versions of cocoapods and activesupport that causes build failures.
gem 'cocoapods', '>= 1.13', '!= 1.15.0', '!= 1.15.1'
gem 'activesupport', '>= 7.2.3.1', '!= 7.1.0'
gem 'xcodeproj', '< 1.26.0'
# 1.3.7+ fixes GHSA-h8w8-99g7-qmvj, GHSA-wv3x-4vxv-whpp, GHSA-6wx8-w4f5-wwcr.
# The old '< 1.3.4' pin (logger/activesupport build failures) is obsolete:
# activesupport >= 7.2.3.1 and the explicit 'logger' gem below cover it.
gem 'concurrent-ruby', '>= 1.3.7'

# Ruby 3.4.0 has removed some libraries from the standard library.
gem 'bigdecimal'
gem 'logger'
gem 'benchmark'
gem 'mutex_m'
gem 'nkf'
