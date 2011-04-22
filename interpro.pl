#!/usr/bin/perl

use CGI;

my $cgi = new CGI();

my $agi = uc($cgi->param('agi') || '');

my $filename = 'interpro.json';

print $cgi->header(-Content_type => 'application/json', -Access_Control_Allow_Origin => '*', -Access_Control_Allow_Methods => '*', -Access_Control_Max_Age => '1728000', -Access_Control_Allow_Headers => 'x-requested-with');

my $result = '';
if ( $agi =~ /^AT[0-9A-Z]G\d+\.\d+/) {
    open TAIR, $filename;
    while (<TAIR>) {
        chomp;
        if (/"$agi"/) { 
            $result .= $_;
        }
    }
}
$result =~ s/,$//;

print "[$result]\n";
