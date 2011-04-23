#!/usr/bin/ruby

require 'rubygems'
require 'getoptlong'
require 'fastercsv'
require 'spreadsheet'
require 'cgi'
require 'base64'
require 'tempfile'
require 'roo'
require 'json'

ENV['ROO_TMP'] = Dir.tmpdir()

cgi = CGI.new
params = cgi.params

infile = nil

data_file = Tempfile.new(['converter','.xlsx'])
filename = ''

puts cgi.header('text/plain')

data = []

if params && params.has_key?("file")
    file = params["file"].first
    filename = file.original_filename
    data_file << file.read
end

if ENV['HTTP_UP_FILENAME']
  filename = ENV['HTTP_UP_FILENAME']
  data_file << ((ENV['HTTP_NO_BASE64'] == "true") ? params.keys[0] : Base64.decode64(params.keys[0].gsub(/\s/, '+')+'='))
end

data_file.close()


if filename =~ /csv$/
  data = FasterCSV.read(data_file.path)
elsif filename =~ /xls$/
  workbook = Spreadsheet.open(data_file.path)
  a_sheet = workbook.worksheet(0)
  (a_sheet.dimensions[0]..(a_sheet.dimensions[1] - 1)).each { |row_num|
    data.push(a_sheet.row(row_num))
  }
elsif filename =~ /xlsx$/
  workbook = Excelx.new(data_file.path)
  workbook.default_sheet = workbook.sheets.first
  (workbook.first_row..workbook.last_row).each { |row_num|
    data.push(workbook.row(row_num))
  }
elsif filename =~ /txt$/
  data_file.open().each { |line|
    data.push(line.split(/[,\t\s]/))
  }
end

puts data.to_json

data_file.unlink()

