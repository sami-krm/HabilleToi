Pod::Spec.new do |s|
  s.name           = 'SubjectLift'
  s.version        = '1.0.0'
  s.summary        = 'Détourage du sujet d’une photo avec Vision (iOS 17+)'
  s.author         = ''
  s.homepage       = 'https://github.com/sami-krm/meteo-vetements'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
