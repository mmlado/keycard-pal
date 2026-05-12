require 'xcodeproj'

project_path = File.join(__dir__, '..', 'ios', 'GapSign.xcodeproj')
project = Xcodeproj::Project.open(project_path)

target = project.targets.find { |t| t.name == 'GapSign' }
group = project.groups.find { |g| g.name == 'GapSign' } ||
        project.main_group.find_subpath('GapSign', false)

files = ['CameraView.h', 'CameraView.m', 'CameraViewManager.m']

files.each do |filename|
  next if group.files.any? { |f| f.display_name == filename }

  file_ref = group.new_reference("GapSign/#{filename}")

  next if filename.end_with?('.h')
  target.source_build_phase.add_file_reference(file_ref)
  puts "Added #{filename}"
end

project.save
puts 'Project saved.'
