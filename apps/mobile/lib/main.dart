import 'package:flutter/material.dart';

import 'screens/dashboard_page.dart';
import 'screens/login_page.dart';

void main() => runApp(const LogixApp());

class LogixApp extends StatelessWidget {
  const LogixApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'KYNOX LOGIX',
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xff16324f),
          ),
          useMaterial3: true,
        ),
        home: const LoginPage(),
        routes: {'/dashboard': (_) => const DashboardPage()},
      );
}
