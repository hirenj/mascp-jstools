#!/usr/bin/perl -w

use CGI;

my $cgi = new CGI();

my $agi = uc($cgi->param('agi') || '');

my $filename = 'snps-json.txt';

if ($cgi->request_method()) {
    print $cgi->header(-Content_type => 'application/json', -Access_Control_Allow_Origin => '*', -Access_Control_Allow_Methods => '*', -Access_Control_Max_Age => '1728000', -Access_Control_Allow_Headers => 'x-requested-with');
}
print "{";
    if ( $agi =~ /^AT[0-9A-Z]G\d+\.\d+/) {
        my $command = "fgrep '/*$agi*/' $filename";
        my $grepped = `$command`;
        $grepped =~ s/\/\*.*\*\///g;
        $grepped =~ s/,$//;
        print $grepped;
    }

print "}";